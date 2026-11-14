import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { categories, imageOptions, seedEvents } from "./catalog.ts";
import { isMessinaArea, isMessinaCity } from "./messina.ts";
import { AppError, integer, textField } from "./security.ts";
import { eventIsPrivate, organizerDemoMode, sampleListingsEnabled } from "./demo.ts";
import { previewIncludedVat, previewTicketReferences, previewVatPercent } from "./ticket-preview.ts";
import { uploadedEventImageId } from "./event-image.ts";
import { BUSINESS_COUNTRIES } from "./business-countries.ts";
import {
  isPlatformTestBooking,
  PLATFORM_TEST_ACCOUNT,
  platformCheckoutTestEnabled,
} from "./platform-checkout-test.ts";
import type {
  Booking,
  BusinessProfile,
  BusinessProfileKind,
  Event,
  User,
  Category,
  Ticket,
  TicketType,
  Venue,
  VenueType,
} from "./types.ts";

type SqlValue = string | number | boolean | Date | Buffer | null;
type RuntimeState = typeof globalThis & {
  __eventlyPostgresPool?: Pool;
  __eventlyPostgresReady?: Promise<void>;
};
const runtime = globalThis as RuntimeState;
const transactionClient = new AsyncLocalStorage<PoolClient>();
let savepointNumber = 0;

// Parse PostgreSQL BIGINT timestamps and counts as JavaScript numbers.
types.setTypeParser(20, Number);

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, interests TEXT NOT NULL DEFAULT '[]',
    stripe_account TEXT, created_at BIGINT NOT NULL,
    email_verified_at BIGINT NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS social_identities (
    provider TEXT NOT NULL, subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY(provider,subject)
  );
  CREATE INDEX IF NOT EXISTS social_identities_user ON social_identities(user_id);
  CREATE TABLE IF NOT EXISTS oauth_login_states (
    state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL,
    binding_hash TEXT NOT NULL, nonce TEXT NOT NULL,
    verifier TEXT NOT NULL, next_path TEXT NOT NULL,
    auth_page TEXT NOT NULL, expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
    owner_id TEXT REFERENCES users(id), data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS event_images (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL, bytes BYTEA NOT NULL, created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS event_images_owner ON event_images(owner_id);
  CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS venues_owner ON venues(owner_id);
  CREATE TABLE IF NOT EXISTS business_profiles (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS business_profiles_owner ON business_profiles(owner_id,kind);
  CREATE TABLE IF NOT EXISTS saved (
    user_id TEXT REFERENCES users(id), event_id TEXT REFERENCES events(id),
    PRIMARY KEY(user_id,event_id)
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    event_id TEXT NOT NULL REFERENCES events(id),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10),
    total BIGINT NOT NULL CHECK(total >= 0), currency TEXT NOT NULL,
    status TEXT NOT NULL, mode TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
    ticket_type TEXT NOT NULL DEFAULT 'standard',
    session_id TEXT UNIQUE, checkout_url TEXT, expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL, checked_in BIGINT NOT NULL DEFAULT 0,
    request_key TEXT NOT NULL UNIQUE, stripe_account TEXT,
    refund_requested BIGINT NOT NULL DEFAULT 0,
    preview_vat_percent INTEGER NOT NULL DEFAULT 0,
    preview_vat_amount BIGINT NOT NULL DEFAULT 0,
    preview_ticket_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    demo_guest_name TEXT
  );
  CREATE INDEX IF NOT EXISTS bookings_event_status ON bookings(event_id,status);
  CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id);
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_tokens_user ON account_tokens(user_id,purpose);
  CREATE TABLE IF NOT EXISTS music_connections (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, credentials TEXT NOT NULL, consent_at BIGINT NOT NULL,
    PRIMARY KEY(user_id,provider)
  );
  CREATE TABLE IF NOT EXISTS music_profiles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, data TEXT NOT NULL, updated_at BIGINT NOT NULL,
    PRIMARY KEY(user_id,provider)
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_hash TEXT NOT NULL, verifier TEXT NOT NULL, expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_feedback (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL, created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS demo_feedback_created ON demo_feedback(created_at);
`;

function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required to connect Evently to PostgreSQL.");
  if (!runtime.__eventlyPostgresPool) {
    const schemaName = process.env.DATABASE_SCHEMA;
    const poolSize = Number(process.env.DATABASE_POOL_SIZE || 5);
    if (!Number.isSafeInteger(poolSize) || poolSize < 1)
      throw new Error("DATABASE_POOL_SIZE must be a positive whole number.");
    if (schemaName && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))
      throw new Error("DATABASE_SCHEMA contains invalid characters.");
    runtime.__eventlyPostgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      options: schemaName
        ? "-c search_path=" + schemaName + ",public"
        : undefined,
    });
  }
  return runtime.__eventlyPostgresPool;
}

async function initialize() {
  const client = await pool().connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [71834219]);
    locked = true;
    if (process.env.DATABASE_SCHEMA) {
      const schemaName = process.env.DATABASE_SCHEMA;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))
        throw new Error("DATABASE_SCHEMA contains invalid characters.");
      await client.query('CREATE SCHEMA IF NOT EXISTS "' + schemaName + '"');
    }
    await client.query(schema);
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at BIGINT NOT NULL DEFAULT 0",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_requested BIGINT NOT NULL DEFAULT 0",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_type TEXT NOT NULL DEFAULT 'standard'",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS demo_guest_name TEXT",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preview_vat_percent INTEGER NOT NULL DEFAULT 0",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preview_vat_amount BIGINT NOT NULL DEFAULT 0",
    );
    await client.query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preview_ticket_refs JSONB NOT NULL DEFAULT '[]'::jsonb",
    );
    if (sampleListingsEnabled()) {
      const count = await client.query<{ n: number }>(
        "SELECT COUNT(*)::integer AS n FROM events",
      );
      if (!count.rows[0]?.n) {
        for (const event of seedEvents())
          await client.query(
            "INSERT INTO events(id,slug,owner_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
            [event.id, event.slug, null, JSON.stringify(event)],
          );
      }
      const currentSamples = new Map(
        seedEvents().map((event) => [event.id, event]),
      );
      const rows = await client.query<{ id: string; data: string }>(
        "SELECT id,data FROM events",
      );
      for (const row of rows.rows) {
        const event = JSON.parse(row.data) as Event;
        const currentSample = currentSamples.get(event.id);
        if (!event.sample || !currentSample) continue;
        const refreshDate = Date.parse(event.startsAt) <= Date.now();
        const refreshCover =
          currentSample.coverImage &&
          currentSample.coverImage !== event.coverImage;
        const refreshTicketTypes =
          currentSample.vipPrice !== event.vipPrice ||
          currentSample.vipCapacity !== event.vipCapacity;
        if (refreshDate || refreshCover || refreshTicketTypes)
          await client.query("UPDATE events SET data=$1 WHERE id=$2", [
            JSON.stringify({
              ...event,
              startsAt: refreshDate ? currentSample.startsAt : event.startsAt,
              endsAt: refreshDate ? currentSample.endsAt : event.endsAt,
              coverImage: currentSample.coverImage ?? event.coverImage,
              vipPrice: currentSample.vipPrice,
              vipCapacity: currentSample.vipCapacity,
            }),
            row.id,
          ]);
      }
    }
  } finally {
    if (locked)
      await client
        .query("SELECT pg_advisory_unlock($1)", [71834219])
        .catch(() => {});
    client.release();
  }
}

export function initializeDatabase() {
  if (!runtime.__eventlyPostgresReady) {
    runtime.__eventlyPostgresReady = initialize().catch((error) => {
      runtime.__eventlyPostgresReady = undefined;
      throw error;
    });
  }
  return runtime.__eventlyPostgresReady;
}

export async function resetDatabaseForTests() {
  if (process.env.EVENTLY_TEST_MODE !== "true")
    throw new Error("Test database reset requires EVENTLY_TEST_MODE=true.");
  await initializeDatabase();
  await pool().query(
    "TRUNCATE TABLE demo_feedback,oauth_states,oauth_login_states,social_identities,music_profiles,music_connections,account_tokens,rate_limits,bookings,saved,sessions,events,venues,business_profiles,users CASCADE",
  );
}

export async function closeDatabase() {
  if (!runtime.__eventlyPostgresPool) return;
  await runtime.__eventlyPostgresPool.end();
  runtime.__eventlyPostgresPool = undefined;
  runtime.__eventlyPostgresReady = undefined;
}

function postgresParameters(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => "$" + ++index);
}

async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: SqlValue[],
) {
  await initializeDatabase();
  const client = transactionClient.getStore();
  return client
    ? client.query<T>(postgresParameters(sql), values)
    : pool().query<T>(postgresParameters(sql), values);
}

export async function one<T>(sql: string, ...values: SqlValue[]) {
  const result = await query(sql, values);
  const row = result.rows[0];
  return row ? ({ ...row } as T) : undefined;
}
export async function all<T>(sql: string, ...values: SqlValue[]) {
  const result = await query(sql, values);
  return result.rows.map((row) => ({ ...row }) as T);
}
export async function run(sql: string, ...values: SqlValue[]) {
  const result = await query(sql, values);
  return { changes: result.rowCount || 0 };
}
export async function transaction<T>(fn: () => T | Promise<T>): Promise<T> {
  const active = transactionClient.getStore();
  if (active) {
    const savepoint = "evently_nested_" + ++savepointNumber;
    await active.query("SAVEPOINT " + savepoint);
    try {
      const result = await fn();
      await active.query("RELEASE SAVEPOINT " + savepoint);
      return result;
    } catch (error) {
      await active.query("ROLLBACK TO SAVEPOINT " + savepoint).catch(() => {});
      await active.query("RELEASE SAVEPOINT " + savepoint).catch(() => {});
      throw error;
    }
  }
  await initializeDatabase();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    return await transactionClient.run(client, async () => {
      try {
        const result = await fn();
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    });
  } finally {
    client.release();
  }
}
export function publicUser(
  row: Record<string, unknown> | undefined,
): User | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    interests: JSON.parse(String(row.interests)) as Category[],
    stripeAccount: row.stripe_account ? String(row.stripe_account) : null,
    emailVerified: Boolean(row.email_verified_at),
  };
}
export async function userById(id: string) {
  return publicUser(
    await one<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", id),
  );
}
async function hydrateEvent(row: { data: string }): Promise<Event> {
  const event = JSON.parse(row.data) as Event;
  if (event.sample && event.id === "sample-1" && !event.genres)
    event.genres = ["Electronic", "House"];
  const reserved = await one<{ standard: number; vip: number }>(
    "SELECT COALESCE(SUM(quantity) FILTER (WHERE ticket_type='standard'),0) AS standard, COALESCE(SUM(quantity) FILTER (WHERE ticket_type='vip'),0) AS vip FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",
    event.id,
  );
  const standardReserved = reserved?.standard || 0;
  const vipReserved = reserved?.vip || 0;
  const vipCapacity = event.vipCapacity || 0;
  const standardCapacity = Math.max(0, event.capacity - vipCapacity);
  return {
    ...event,
    available: Math.max(0, event.capacity - standardReserved - vipReserved),
    standardAvailable: Math.max(0, standardCapacity - standardReserved),
    vipAvailable: Math.max(0, vipCapacity - vipReserved),
  };
}
export async function listEvents() {
  const events = await Promise.all(
    (await all<{ data: string }>("SELECT data FROM events")).map(hydrateEvent),
  );
  return events
    .filter((event) => !eventIsPrivate(event) && (!event.sample || sampleListingsEnabled()))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export async function getEvent(id: string) {
  const row = await one<{ data: string }>(
    "SELECT data FROM events WHERE id=? OR slug=?",
    id,
    id,
  );
  if (!row) return null;
  const event = await hydrateEvent(row);
  return event.sample && !sampleListingsEnabled() ? null : event;
}
export async function saveEventImage(ownerId: string, mediaType: string, bytes: Buffer) {
  const id = randomUUID();
  await run(
    "INSERT INTO event_images(id,owner_id,media_type,bytes,created_at) VALUES(?,?,?,?,?)",
    id,
    ownerId,
    mediaType,
    bytes,
    Date.now(),
  );
  return "/api/event-images/" + id;
}
export async function eventImageById(id: string) {
  return one<{ mediaType: string; bytes: Buffer }>(
    'SELECT media_type AS "mediaType", bytes FROM event_images WHERE id=?',
    id,
  );
}
export async function assertOwnedEventImage(path: string | undefined, ownerId: string) {
  if (!path) return;
  const id = uploadedEventImageId(path);
  if (!id || !(await one("SELECT id FROM event_images WHERE id=? AND owner_id=?", id, ownerId)))
    throw new AppError("Choose a cover image you uploaded.", 400);
}
export async function getBusinessProfile(id: string) {
  const row = await one<{ data: string }>(
    "SELECT data FROM business_profiles WHERE id=?",
    id,
  );
  return row ? (JSON.parse(row.data) as BusinessProfile) : null;
}
export async function getOwnedBusinessProfile(
  id: string,
  ownerId: string,
  kind?: BusinessProfileKind,
) {
  const row = await one<{ data: string }>(
    "SELECT data FROM business_profiles WHERE id=? AND owner_id=?" +
      (kind ? " AND kind=?" : ""),
    ...([id, ownerId, ...(kind ? [kind] : [])] as [string, string, ...string[]]),
  );
  return row ? (JSON.parse(row.data) as BusinessProfile) : null;
}
export async function businessProfilesForOwner(
  ownerId: string,
  kind?: BusinessProfileKind,
) {
  return (await all<{ data: string }>(
    "SELECT data FROM business_profiles WHERE owner_id=?" +
      (kind ? " AND kind=?" : ""),
    ...([ownerId, ...(kind ? [kind] : [])] as [string, ...string[]]),
  ))
    .map((row) => JSON.parse(row.data) as BusinessProfile)
    .sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
}
function validateBusinessProfile(
  input: Record<string, unknown>,
  existing?: BusinessProfile,
): Omit<BusinessProfile, "id" | "ownerId" | "createdAt" | "updatedAt"> {
  const kind = textField(
    input.kind ?? existing?.kind,
    "Business profile type",
    1,
    20,
  ) as BusinessProfileKind;
  if (kind !== "organizer" && kind !== "venue")
    throw new AppError("Choose organizer or venue as the profile type.");
  const countryCode =
    kind === "venue"
      ? "IT"
      : String(input.countryCode ?? existing?.countryCode ?? "IT").toUpperCase();
  if (!BUSINESS_COUNTRIES.some((country) => country === countryCode))
    throw new AppError("Choose a supported business country.");
  if (
    existing?.stripeAccount &&
    countryCode !== existing.countryCode
  )
    throw new AppError("Business country cannot change after Stripe setup.", 409);
  return {
    kind,
    name: textField(input.name ?? existing?.name, "Business profile name", 2, 120),
    countryCode,
    stripeAccount: existing?.stripeAccount || null,
  };
}
export async function createBusinessProfile(
  input: Record<string, unknown>,
  owner: User,
) {
  const now = Date.now();
  const value: BusinessProfile = {
    ...validateBusinessProfile(input),
    id: randomUUID(),
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
  };
  await run(
    "INSERT INTO business_profiles(id,owner_id,kind,data) VALUES(?,?,?,?)",
    value.id,
    owner.id,
    value.kind,
    JSON.stringify(value),
  );
  return value;
}
export async function updateBusinessProfile(
  id: string,
  ownerId: string,
  input: Record<string, unknown>,
) {
  const existing = await getOwnedBusinessProfile(id, ownerId);
  if (!existing) throw new AppError("Business profile not found.", 404);
  const value: BusinessProfile = {
    ...validateBusinessProfile(input, existing),
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  await transaction(async () => {
    await run(
      "UPDATE business_profiles SET kind=?,data=? WHERE id=? AND owner_id=?",
      value.kind,
      JSON.stringify(value),
      id,
      ownerId,
    );
    if (value.kind === "organizer" && value.name !== existing.name) {
      const organizerProfiles = await businessProfilesForOwner(
        ownerId,
        "organizer",
      );
      const isLegacyDefault = organizerProfiles[0]?.id === id;
      const rows = await all<{ id: string; data: string }>(
        "SELECT id,data FROM events WHERE owner_id=?",
        ownerId,
      );
      for (const row of rows) {
        const event = JSON.parse(row.data) as Event;
        if (
          event.organizerProfileId === id ||
          (isLegacyDefault && !event.organizerProfileId)
        ) {
          await run(
            "UPDATE events SET data=? WHERE id=? AND owner_id=?",
            JSON.stringify({ ...event, host: value.name }),
            row.id,
            ownerId,
          );
        }
      }
    }
  });
  return value;
}
export async function ensureBusinessProfile(
  owner: User,
  kind: BusinessProfileKind,
) {
  const existing = await businessProfilesForOwner(owner.id, kind);
  if (existing.length) {
    if (kind === "organizer" && owner.stripeAccount && !existing[0].stripeAccount)
      return saveBusinessProfileStripeAccount(
        existing[0].id,
        owner.id,
        owner.stripeAccount,
      );
    return existing[0];
  }
  const created = await createBusinessProfile(
    {
      kind,
      name: owner.name + (kind === "organizer" ? " Events" : " Venues"),
      countryCode: "IT",
    },
    owner,
  );
  if (kind === "organizer" && owner.stripeAccount)
    return saveBusinessProfileStripeAccount(
      created.id,
      owner.id,
      owner.stripeAccount,
    );
  return created;
}
export async function saveBusinessProfileStripeAccount(
  profileId: string,
  ownerId: string,
  stripeAccount: string,
) {
  const profile = await getOwnedBusinessProfile(profileId, ownerId, "organizer");
  if (!profile) throw new AppError("Organizer profile not found.", 404);
  const updated: BusinessProfile = {
    ...profile,
    stripeAccount,
    updatedAt: Date.now(),
  };
  await run(
    "UPDATE business_profiles SET data=? WHERE id=? AND owner_id=?",
    JSON.stringify(updated),
    profileId,
    ownerId,
  );
  return updated;
}
export async function getVenue(id: string) {
  const row = await one<{ data: string }>(
    "SELECT data FROM venues WHERE id=?",
    id,
  );
  return row ? (JSON.parse(row.data) as Venue) : null;
}
export async function getOwnedVenue(id: string, ownerId: string) {
  const row = await one<{ data: string }>(
    "SELECT data FROM venues WHERE id=? AND owner_id=?",
    id,
    ownerId,
  );
  return row ? (JSON.parse(row.data) as Venue) : null;
}
export async function venuesForOwner(ownerId: string) {
  return (await all<{ data: string }>(
    "SELECT data FROM venues WHERE owner_id=?",
    ownerId,
  ))
    .map((row) => JSON.parse(row.data) as Venue)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}
export function validateVenue(
  input: Record<string, unknown>,
  existing?: Venue,
): Omit<Venue, "id" | "ownerId" | "createdAt" | "updatedAt"> {
  const type = textField(input.type, "Venue type", 1, 30) as VenueType;
  if (
    ![
      "club",
      "concert-hall",
      "bar-restaurant",
      "outdoor",
      "gallery",
      "community",
      "other",
    ].includes(type)
  )
    throw new AppError("Choose a valid venue type.");
  return {
    ...(typeof input.hostProfileId === "string" && input.hostProfileId.trim()
      ? { hostProfileId: input.hostProfileId.trim() }
      : existing?.hostProfileId
        ? { hostProfileId: existing.hostProfileId }
        : {}),
    name: textField(input.name, "Venue name", 2, 120),
    type,
    description: optionalText(input.description, "Description", 800),
    address: textField(input.address, "Street address", 5, 300),
    city: textField(input.city, "City", 2, 80),
    postalCode: textField(input.postalCode, "Postcode", 3, 20),
    countryCode: "IT",
    timezone: "Europe/Rome",
    capacity: integer(input.capacity, "Venue capacity", 1, 100000),
    spaces: parseTags(input.spaces, "Spaces", 20),
    facilities: parseTags(input.facilities, "Facilities", 30),
    accessibility: parseTags(input.accessibility, "Accessibility details", 20),
    houseRules: optionalText(input.houseRules, "House rules", 2000),
    setupNotes: optionalText(input.setupNotes, "Setup notes", 2000),
    active:
      typeof input.active === "boolean" ? input.active : existing?.active ?? true,
  };
}
function optionalText(value: unknown, name: string, max: number) {
  if (value === undefined || value === null || value === "") return "";
  return textField(value, name, 0, max);
}
export async function createVenue(
  input: Record<string, unknown>,
  owner: User,
) {
  const profileId =
    typeof input.hostProfileId === "string" && input.hostProfileId.trim()
      ? input.hostProfileId.trim()
      : (await ensureBusinessProfile(owner, "venue")).id;
  const profile = await getOwnedBusinessProfile(profileId, owner.id, "venue");
  if (!profile) throw new AppError("Choose one of your venue profiles.", 400);
  const now = Date.now();
  const venue: Venue = {
    ...validateVenue({ ...input, hostProfileId: profile.id }),
    id: randomUUID(),
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
  };
  await run(
    "INSERT INTO venues(id,owner_id,data) VALUES(?,?,?)",
    venue.id,
    owner.id,
    JSON.stringify(venue),
  );
  return venue;
}
export async function updateVenue(
  id: string,
  ownerId: string,
  input: Record<string, unknown>,
) {
  const existing = await getOwnedVenue(id, ownerId);
  if (!existing) throw new AppError("Venue not found.", 404);
  const profileId =
    typeof input.hostProfileId === "string" && input.hostProfileId.trim()
      ? input.hostProfileId.trim()
      : existing.hostProfileId;
  if (profileId && !(await getOwnedBusinessProfile(profileId, ownerId, "venue")))
    throw new AppError("Choose one of your venue profiles.", 400);
  const linkedEvents = await all<{ data: string }>(
    "SELECT data FROM events WHERE owner_id=?",
    ownerId,
  );
  const nextCapacity = integer(input.capacity, "Venue capacity", 1, 100000);
  const overCapacityEvent = linkedEvents
    .map((row) => JSON.parse(row.data) as Event)
    .find((event) => event.venueId === existing.id && event.capacity > nextCapacity);
  if (overCapacityEvent)
    throw new AppError(
      "Venue capacity cannot be lower than the ticket capacity for “" +
        overCapacityEvent.title +
        ".”",
      400,
    );
  const venue: Venue = {
    ...validateVenue({ ...input, hostProfileId: profileId }, existing),
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  await run(
    "UPDATE venues SET data=? WHERE id=? AND owner_id=?",
    JSON.stringify(venue),
    id,
    ownerId,
  );
  return venue;
}
export async function savedIds(userId: string) {
  return (await all<{ event_id: string }>(
    "SELECT event_id FROM saved WHERE user_id=?",
    userId,
  )).map((r) => r.event_id);
}
export async function saveEvent(userId: string, eventId: string, saved: boolean) {
  const event = await getEvent(eventId);
  if (!event || eventIsPrivate(event))
    throw new AppError("Event not found.", 404);
  if (saved)
    await run(
      "INSERT INTO saved(user_id,event_id) VALUES(?,?) ON CONFLICT(user_id,event_id) DO NOTHING",
      userId,
      eventId,
    );
  else await run("DELETE FROM saved WHERE user_id=? AND event_id=?", userId, eventId);
  return await savedIds(userId);
}
export async function updateInterests(userId: string, value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some((v) => !categories.some((c) => c.id === v))
  )
    throw new AppError("Choose valid interests.");
  const interests = [...new Set(value)];
  await run(
    "UPDATE users SET interests=? WHERE id=?",
    JSON.stringify(interests),
    userId,
  );
  return (await userById(userId))!;
}
export function validateEvent(
  input: Record<string, unknown>,
  owner: User,
  organizerProfile?: BusinessProfile,
): Omit<Event, "id" | "slug"> {
  const category = textField(input.category, "Category") as Category;
  if (!categories.some((c) => c.id === category))
    throw new AppError("Choose a valid category.");
  const image = textField(input.image, "Cover");
  if (!imageOptions.some((i) => i.id === image))
    throw new AppError("Choose a cover image.");
  const coverImage = input.coverImage ? textField(input.coverImage, "Cover image", 1, 100) : "";
  if (coverImage && !uploadedEventImageId(coverImage))
    throw new AppError("Choose a valid uploaded cover image.");
  const venueId = optionalText(input.venueId, "Venue", 100);
  const start = Date.parse(textField(input.startsAt, "Start date"));
  const end = Date.parse(textField(input.endsAt, "End date"));
  if (
    !Number.isFinite(start) ||
    start < Date.now() + 60_000 ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 31 * 86400000
  )
    throw new AppError(
      "Choose a future start time and an end time after it (within 31 days).",
    );
  const timezone = textField(input.timezone, "Timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new AppError("Choose a valid timezone.");
  }
  const currency = String(input.currency).toLowerCase();
  if (!["gbp", "eur", "usd"].includes(currency))
    throw new AppError("Choose GBP, EUR or USD.");
  const capacity = integer(input.capacity, "Capacity", 1, 100000);
  const price = integer(input.price, "Ticket price", 0, 1000000);
  const vipCapacity =
    input.vipCapacity === undefined ||
    input.vipCapacity === null ||
    input.vipCapacity === 0 ||
    input.vipCapacity === ""
      ? 0
      : integer(input.vipCapacity, "VIP capacity", 1, 100000);
  const vipPrice =
    input.vipPrice === undefined ||
    input.vipPrice === null ||
    input.vipPrice === ""
      ? undefined
      : integer(input.vipPrice, "VIP ticket price", 0, 1000000);
  if (vipCapacity > capacity)
    throw new AppError("VIP capacity cannot exceed total event capacity.");
  if ((vipCapacity > 0) !== (vipPrice !== undefined))
    throw new AppError("Set both a VIP ticket price and VIP capacity.");
  if (vipPrice !== undefined && vipPrice > 0 && vipPrice < 100)
    throw new AppError(
      "Paid VIP tickets must cost at least 1 in the selected currency.",
    );
  if (price > 0 && price < 100)
    throw new AppError(
      "Paid tickets must cost at least 1 in the selected currency.",
    );
  const city = textField(input.city, "City", 2, 80);
  const area = input.area === undefined || input.area === "" ? undefined : input.area;
  if (area !== undefined && (!isMessinaCity(city) || !isMessinaArea(area)))
    throw new AppError("Choose a valid Messina area.");
  const accessNotes = input.accessNotes === undefined || input.accessNotes === ""
    ? undefined
    : textField(input.accessNotes, "Access and arrival details", 1, 500);
  return {
    ownerId: owner.id,
    title: textField(input.title, "Event title", 5, 100),
    description: textField(input.description, "Description", 40, 8000),
    category,
    city,
    ...(area ? { area } : {}),
    venue: textField(input.venue, "Venue", 2, 120),
    address: textField(input.address, "Address", 5, 300),
    ...(accessNotes ? { accessNotes } : {}),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    timezone,
    price,
    ...(vipPrice !== undefined ? { vipPrice } : {}),
    currency,
    capacity,
    ...(vipCapacity > 0 ? { vipCapacity } : {}),
    available: capacity,
    image,
    ...(coverImage ? { coverImage } : {}),
    host: organizerProfile?.name || owner.name,
    ...(venueId ? { venueId } : {}),
    ...(organizerProfile ? { organizerProfileId: organizerProfile.id } : {}),
    sample: false,
    artists: parseTags(input.artists, "Artists", 30),
    genres: parseTags(input.genres, "Genres", 12),
  };
}
export function parseTags(value: unknown, label: string, max: number) {
  if (value === undefined || value === "") return [];
  const values = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(values) || values.length > max)
    throw new AppError("Use up to " + max + " " + label.toLowerCase() + ".");
  return [...new Set(values.map((entry) => textField(entry, label, 1, 80)))];
}
export async function createEvent(
  input: Record<string, unknown>,
  owner: User,
  selectedProfile?: BusinessProfile,
) {
  const profileId =
    selectedProfile?.id ||
    (typeof input.organizerProfileId === "string"
      ? input.organizerProfileId
      : "");
  const organizerProfile = profileId
    ? await getOwnedBusinessProfile(profileId, owner.id, "organizer")
    : selectedProfile || (await ensureBusinessProfile(owner, "organizer"));
  if (!organizerProfile)
    throw new AppError("Choose one of your organizer profiles.", 400);
  const content = validateEvent(input, owner, organizerProfile);
  if (!content.coverImage)
    throw new AppError("Upload an event photo before publishing.");
  await assertOwnedEventImage(content.coverImage, owner.id);
  const id = randomUUID();
  const slug =
    content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) +
    "-" +
    id.slice(0, 8);
  const event: Event = {
    ...content,
    id,
    slug,
    visibility: organizerDemoMode() ? "draft" : "published",
  };
  await run(
    "INSERT INTO events(id,slug,owner_id,data) VALUES(?,?,?,?)",
    id,
    slug,
    owner.id,
    JSON.stringify(event),
  );
  return event;
}
const bookingColumns =
  'id, user_id AS "userId", event_id AS "eventId", ticket_type AS "ticketType", quantity, total, currency, status, mode, code, session_id AS "sessionId", checkout_url AS "checkoutUrl", expires_at AS "expiresAt", created_at AS "createdAt", checked_in AS "checkedIn", request_key AS "requestKey", stripe_account AS "stripeAccount", refund_requested AS "refundRequested", preview_vat_percent AS "previewVatPercent", preview_vat_amount AS "previewVatAmount", preview_ticket_refs AS "previewTicketRefs", demo_guest_name AS "demoGuestName"';
export async function bookingById(id: string) {
  return one<Booking>(
    "SELECT " + bookingColumns + " FROM bookings WHERE id=?",
    id,
  );
}
export async function listTickets(userId: string): Promise<Ticket[]> {
  const bookings = await all<Booking>(
    "SELECT " +
      bookingColumns +
      " FROM bookings WHERE user_id=? ORDER BY created_at DESC",
    userId,
  );
  return Promise.all(
    bookings.map(async (booking) => ({
      ...booking,
      event: (await getEvent(booking.eventId))!,
    })),
  );
}
export async function reserveBooking(
  userId: string,
  eventId: string,
  quantity: number,
  nonce: string,
  ticketType: TicketType = "standard",
): Promise<Booking> {
  integer(quantity, "Quantity", 1, 10);
  if (ticketType !== "standard" && ticketType !== "vip")
    throw new AppError("Choose a valid ticket type.");
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(nonce))
    throw new AppError("Invalid booking request. Refresh and try again.");
  return transaction(async () => {
    const lockedEvent = await one<{ id: string }>(
      "SELECT id FROM events WHERE id=? OR slug=? FOR UPDATE",
      eventId,
      eventId,
    );
    if (!lockedEvent) throw new AppError("Event not found.", 404);
    const key = userId + ":" + nonce;
    const existing = await one<Booking>(
      "SELECT " + bookingColumns + " FROM bookings WHERE request_key=?",
      key,
    );
    if (existing) {
      if (
        existing.eventId !== eventId ||
        existing.quantity !== quantity ||
        existing.ticketType !== ticketType
      )
        throw new AppError("This booking request has already been used.", 409);
      return existing;
    }
    const pending = await one<Booking>(
      "SELECT " +
        bookingColumns +
        " FROM bookings WHERE user_id=? AND event_id=? AND status='pending'",
      userId,
      eventId,
    );
    if (pending) {
      if (pending.quantity !== quantity || pending.ticketType !== ticketType)
        throw new AppError(
          "You already have a checkout for this event. Resume it from My tickets, or cancel it before changing the quantity.",
          409,
        );
      return pending;
    }
    const event = await getEvent(eventId);
    if (!event) throw new AppError("Event not found.", 404);
    if (eventIsPrivate(event))
      throw new AppError("This event is a private draft.", 409);
    if (Date.parse(event.startsAt) <= Date.now())
      throw new AppError("Booking has closed for this event.", 409);
    const tierAvailable =
      ticketType === "vip"
        ? event.vipAvailable || 0
        : event.standardAvailable ?? event.available;
    if (
      ticketType === "vip" &&
      (!event.vipCapacity || event.vipPrice === undefined)
    )
      throw new AppError("VIP tickets are not available for this event.", 409);
    if (quantity > tierAvailable)
      throw new AppError(
        `There are not enough ${ticketType === "vip" ? "VIP" : "Standard"} tickets left. Choose a smaller quantity.`,
        409,
      );
    const unitPrice = ticketType === "vip" ? event.vipPrice! : event.price;
    const mode = event.sample
      ? "sample"
      : unitPrice === 0
        ? "free"
        : "stripe";
    const vatPercent = mode === "stripe" ? previewVatPercent() : 0;
    const total = mode === "sample" ? 0 : quantity * unitPrice;
    const booking: Booking = {
      id: randomUUID(),
      userId,
      eventId,
      ticketType,
      quantity,
      total,
      currency: event.currency,
      status: mode === "stripe" ? "pending" : "confirmed",
      mode,
      code: "EV-" + randomBytes(8).toString("hex").toUpperCase(),
      sessionId: null,
      checkoutUrl: null,
      expiresAt: Math.floor(Date.now() / 1000) + 2100,
      createdAt: Date.now(),
      checkedIn: 0,
      refundRequested: 0,
      previewVatPercent: vatPercent,
      previewVatAmount: vatPercent ? previewIncludedVat(total, vatPercent) : 0,
      previewTicketRefs: [],
      requestKey: key,
      stripeAccount:
        mode === "stripe" && platformCheckoutTestEnabled()
          ? PLATFORM_TEST_ACCOUNT
          : event.organizerProfileId
            ? (await getBusinessProfile(event.organizerProfileId))?.stripeAccount ||
              (event.ownerId ? (await userById(event.ownerId))?.stripeAccount || null : null)
            : event.ownerId
              ? (await userById(event.ownerId))?.stripeAccount || null
              : null,
    };
    await run(
      "INSERT INTO bookings(id,user_id,event_id,ticket_type,quantity,total,currency,status,mode,code,expires_at,created_at,request_key,stripe_account,preview_vat_percent,preview_vat_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      booking.id,
      userId,
      eventId,
      ticketType,
      quantity,
      booking.total,
      booking.currency,
      booking.status,
      booking.mode,
      booking.code,
      booking.expiresAt,
      booking.createdAt,
      key,
      booking.stripeAccount,
      booking.previewVatPercent,
      booking.previewVatAmount,
    );
    return booking;
  });
}
export async function attachCheckout(
  id: string,
  sessionId: string,
  url: string | null,
) {
  return await run(
    "UPDATE bookings SET session_id=?, checkout_url=? WHERE id=? AND (session_id IS NULL OR session_id=?)",
    sessionId,
    url,
    id,
    sessionId,
  );
}
export async function confirmPayment(
  session: {
    id: string;
    client_reference_id: string | null;
    amount_total: number | null;
    currency: string | null;
    payment_status: string;
    livemode?: boolean;
    metadata: Record<string, string> | null;
  },
  account: string | undefined,
) {
  if (session.payment_status !== "paid") return;
  return await transaction(async () => {
    const booking = session.client_reference_id
      ? await one<Booking>(
          "SELECT " + bookingColumns + " FROM bookings WHERE id=? FOR UPDATE",
          session.client_reference_id,
        )
      : undefined;
    if (!booking || booking.mode !== "stripe")
      throw new AppError("Payment does not match a booking.", 400);
    if (!account || booking.stripeAccount !== account)
      throw new AppError("Payment account does not match.", 400);
    if (isPlatformTestBooking(booking) && session.livemode !== false)
      throw new AppError("A test booking requires a test payment.", 400);
    if (booking.sessionId && booking.sessionId !== session.id)
      throw new AppError("Unexpected payment session.", 400);
    if (
      booking.total !== session.amount_total ||
      booking.currency !== session.currency ||
      session.metadata?.booking_id !== booking.id
    )
      throw new AppError("Payment amount or metadata does not match.", 400);
    if (booking.status === "confirmed" || booking.status === "refunded") return;
    if (booking.status !== "pending")
      throw new AppError("Booking is no longer pending.", 409);
    if (booking.previewVatPercent && session.livemode === true)
      throw new AppError("A test booking cannot be confirmed by a live payment.", 400);
    const previewRefs = booking.previewVatPercent
      ? previewTicketReferences(booking.id, booking.quantity)
      : [];
    await run(
      "UPDATE bookings SET status='confirmed',session_id=?,preview_ticket_refs=?::jsonb WHERE id=?",
      session.id,
      JSON.stringify(previewRefs),
      booking.id,
    );
  });
}
export async function expireBooking(sessionId: string, bookingId?: string) {
  return await run(
    "UPDATE bookings SET status='expired',session_id=COALESCE(session_id,?) WHERE status='pending' AND (session_id=? OR (id=? AND session_id IS NULL))",
    sessionId,
    sessionId,
    bookingId || "",
  );
}
export async function cancelFreeBooking(id: string, userId: string) {
  const booking = await bookingById(id);
  if (!booking || booking.userId !== userId)
    throw new AppError("Booking not found.", 404);
  if (booking.mode === "stripe")
    throw new AppError("Paid bookings are refunded by the organizer.");
  if (booking.checkedIn)
    throw new AppError("A checked-in booking cannot be cancelled.", 409);
  if (Date.parse((await getEvent(booking.eventId))!.startsAt) <= Date.now())
    throw new AppError("This event has already started.", 409);
  await run(
    "UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'",
    id,
  );
}
export async function checkIn(
  code: string,
  ownerId: string,
  organizerProfileId?: string,
) {
  return transaction(async () => {
    const booking = await one<Booking>(
      "SELECT " + bookingColumns + " FROM bookings WHERE code=? FOR UPDATE",
      code,
    );
    const event = booking ? await getEvent(booking.eventId) : null;
    if (!booking || event?.ownerId !== ownerId)
      throw new AppError("Ticket not found for one of your events.", 404);
    if (isPlatformTestBooking(booking))
      throw new AppError("Test checkout tickets are not valid for entry.", 409);
    if (organizerProfileId) {
      const eventProfileId =
        event.organizerProfileId ||
        (await businessProfilesForOwner(ownerId, "organizer"))[0]?.id;
      if (eventProfileId !== organizerProfileId)
        throw new AppError("Ticket not found for this organizer profile.", 404);
    }
    if (booking.status !== "confirmed")
      throw new AppError("This ticket is not valid for entry.", 409);
    if (booking.checkedIn)
      throw new AppError("This booking has already been checked in.", 409);
    await run("UPDATE bookings SET checked_in=? WHERE id=?", Date.now(), booking.id);
    return {
      quantity: booking.quantity,
      event: (await getEvent(booking.eventId))!.title,
      name: booking.demoGuestName || (await userById(booking.userId))!.name,
    };
  });
}
export async function addDemoGuest(eventId: string, ownerId: string) {
  if (!organizerDemoMode()) throw new AppError("Demo mode is unavailable.", 404);
  return transaction(async () => {
    const locked = await one<{ id: string }>(
      "SELECT id FROM events WHERE id=? AND owner_id=? FOR UPDATE",
      eventId,
      ownerId,
    );
    if (!locked) throw new AppError("Event not found.", 404);
    const event = await getEvent(eventId);
    if (!event || event.visibility !== "draft")
      throw new AppError("Practice guests require a private event draft.", 409);
    if ((event.standardAvailable ?? event.available) < 1)
      throw new AppError("There are no Standard places left.", 409);
    const count = await one<{ n: number }>(
      "SELECT COUNT(*)::integer AS n FROM bookings WHERE event_id=? AND demo_guest_name IS NOT NULL",
      eventId,
    );
    if ((count?.n || 0) >= 10)
      throw new AppError("This draft already has 10 practice guests.", 409);
    const name = "Sample guest " + ((count?.n || 0) + 1);
    const id = randomUUID();
    const code = "EV-" + randomBytes(8).toString("hex").toUpperCase();
    await run(
      "INSERT INTO bookings(id,user_id,event_id,ticket_type,quantity,total,currency,status,mode,code,expires_at,created_at,request_key,stripe_account,demo_guest_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      ownerId,
      eventId,
      "standard",
      1,
      0,
      event.currency,
      "confirmed",
      "sample",
      code,
      Math.floor(Date.now() / 1000) + 2100,
      Date.now(),
      "demo:" + id,
      null,
      name,
    );
    return { id, name, code };
  });
}
export async function saveDemoFeedback(userId: string, feedback: string) {
  if (!organizerDemoMode()) throw new AppError("Demo mode is unavailable.", 404);
  const content = textField(feedback, "Feedback", 10, 3000);
  await run(
    "INSERT INTO demo_feedback(id,user_id,body,created_at) VALUES(?,?,?,?)",
    randomUUID(),
    userId,
    content,
    Date.now(),
  );
}
export async function requestRefund(id: string, userId: string) {
  const booking = await bookingById(id);
  if (!booking || booking.userId !== userId)
    throw new AppError("Booking not found.", 404);
  if (booking.mode !== "stripe" || booking.status !== "confirmed")
    throw new AppError(
      "Only confirmed paid bookings can request a refund.",
      409,
    );
  await run(
    "UPDATE bookings SET refund_requested=? WHERE id=? AND refund_requested=0",
    Date.now(),
    id,
  );
  return (await bookingById(id))!;
}
export async function organizerData(userId: string) {
  const [allEvents, bookings] = await Promise.all([
    Promise.all(
      (await all<{ data: string }>(
        "SELECT data FROM events WHERE owner_id=?",
        userId,
      )).map(hydrateEvent),
    ),
    all<Booking & { name: string; email: string }>(
    "SELECT " +
      bookingColumns
        .split(", ")
        .map((c) => "b." + c)
        .join(", ") +
      ",COALESCE(b.demo_guest_name,u.name) AS name,CASE WHEN b.demo_guest_name IS NULL THEN u.email ELSE '' END AS email FROM bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id WHERE e.owner_id=? ORDER BY b.created_at DESC",
      userId,
    ),
  ]);
  const now = Date.now();
  const events = allEvents.sort((a, b) => {
    const aEnded = Date.parse(a.endsAt) < now;
    const bEnded = Date.parse(b.endsAt) < now;
    if (aEnded !== bEnded) return Number(aEnded) - Number(bEnded);
    return aEnded
      ? b.startsAt.localeCompare(a.startsAt)
      : a.startsAt.localeCompare(b.startsAt);
  });
  return { events, bookings };
}
export async function takeRateLimit(key: string, max: number, duration = 900000) {
  const now = Date.now();
  const result = await one<{ count: number }>(
    "INSERT INTO rate_limits AS rl(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rl.resets_at <= ? THEN 1 ELSE rl.count+1 END, resets_at=CASE WHEN rl.resets_at <= ? THEN ? ELSE rl.resets_at END RETURNING rl.count AS count",
    key,
    now + duration,
    now,
    now,
    now + duration,
  );
  if ((result?.count || 0) > max)
    throw new AppError(
      "Too many attempts. Please try again in a few minutes.",
      429,
    );
}

export async function discoveryData() {
  const now = Date.now();
  return {
    now,
    events: (await listEvents()).filter((e) => Date.parse(e.startsAt) > now),
  };
}
