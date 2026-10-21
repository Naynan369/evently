import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { categories, imageOptions, seedEvents } from "./catalog.ts";
import { AppError, integer, textField } from "./security.ts";
import type { Booking, Event, User, Category, Ticket } from "./types.ts";

type SqlValue = string | number | boolean | Date | Buffer | null;
type RuntimeState = typeof globalThis & {
  __eventlyPostgresPool?: Pool;
  __eventlyPostgresReady?: Promise<void>;
};
const runtime = globalThis as RuntimeState;
const transactionClient = new AsyncLocalStorage<PoolClient>();
let savepointNumber = 0;

// Keep timestamp/count values as JavaScript numbers, matching the old SQLite API.
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
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
    owner_id TEXT REFERENCES users(id), data TEXT NOT NULL
  );
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
    session_id TEXT UNIQUE, checkout_url TEXT, expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL, checked_in BIGINT NOT NULL DEFAULT 0,
    request_key TEXT NOT NULL UNIQUE, stripe_account TEXT,
    refund_requested BIGINT NOT NULL DEFAULT 0
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
`;

function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required to connect Evently to PostgreSQL.");
  if (!runtime.__eventlyPostgresPool) {
    const schemaName = process.env.DATABASE_SCHEMA;
    if (schemaName && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))
      throw new Error("DATABASE_SCHEMA contains invalid characters.");
    runtime.__eventlyPostgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
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
    if (process.env.SEED_DEMO !== "false") {
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
        if (refreshDate || refreshCover)
          await client.query("UPDATE events SET data=$1 WHERE id=$2", [
            JSON.stringify({
              ...event,
              startsAt: refreshDate ? currentSample.startsAt : event.startsAt,
              endsAt: refreshDate ? currentSample.endsAt : event.endsAt,
              coverImage: currentSample.coverImage ?? event.coverImage,
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
    "TRUNCATE TABLE oauth_states,music_profiles,music_connections,account_tokens,rate_limits,bookings,saved,sessions,events,users CASCADE",
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
  const reserved =
    (await one<{ quantity: number }>(
      "SELECT COALESCE(SUM(quantity),0) AS quantity FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",
      event.id,
    ))?.quantity || 0;
  return { ...event, available: Math.max(0, event.capacity - reserved) };
}
export async function listEvents() {
  const events = await Promise.all(
    (await all<{ data: string }>("SELECT data FROM events")).map(hydrateEvent),
  );
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export async function getEvent(id: string) {
  const row = await one<{ data: string }>(
    "SELECT data FROM events WHERE id=? OR slug=?",
    id,
    id,
  );
  return row ? await hydrateEvent(row) : null;
}
export async function savedIds(userId: string) {
  return (await all<{ event_id: string }>(
    "SELECT event_id FROM saved WHERE user_id=?",
    userId,
  )).map((r) => r.event_id);
}
export async function saveEvent(userId: string, eventId: string, saved: boolean) {
  if (!(await getEvent(eventId))) throw new AppError("Event not found.", 404);
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
): Omit<Event, "id" | "slug"> {
  const category = textField(input.category, "Category") as Category;
  if (!categories.some((c) => c.id === category))
    throw new AppError("Choose a valid category.");
  const image = textField(input.image, "Cover");
  if (!imageOptions.some((i) => i.id === image))
    throw new AppError("Choose a cover image.");
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
  if (price > 0 && price < 100)
    throw new AppError(
      "Paid tickets must cost at least 1 in the selected currency.",
    );
  return {
    ownerId: owner.id,
    title: textField(input.title, "Event title", 5, 100),
    description: textField(input.description, "Description", 40, 8000),
    category,
    city: textField(input.city, "City", 2, 80),
    venue: textField(input.venue, "Venue", 2, 120),
    address: textField(input.address, "Address", 5, 300),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    timezone,
    price,
    currency,
    capacity,
    available: capacity,
    image,
    host: owner.name,
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
export async function createEvent(input: Record<string, unknown>, owner: User) {
  const content = validateEvent(input, owner);
  const id = randomUUID();
  const slug =
    content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) +
    "-" +
    id.slice(0, 8);
  const event: Event = { ...content, id, slug };
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
  'id, user_id AS "userId", event_id AS "eventId", quantity, total, currency, status, mode, code, session_id AS "sessionId", checkout_url AS "checkoutUrl", expires_at AS "expiresAt", created_at AS "createdAt", checked_in AS "checkedIn", request_key AS "requestKey", stripe_account AS "stripeAccount", refund_requested AS "refundRequested"';
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
): Promise<Booking> {
  integer(quantity, "Quantity", 1, 10);
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
      if (existing.eventId !== eventId || existing.quantity !== quantity)
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
      if (pending.quantity !== quantity)
        throw new AppError(
          "You already have a checkout for this event. Resume it from My tickets, or cancel it before changing the quantity.",
          409,
        );
      return pending;
    }
    const event = await getEvent(eventId);
    if (!event) throw new AppError("Event not found.", 404);
    if (Date.parse(event.startsAt) <= Date.now())
      throw new AppError("Booking has closed for this event.", 409);
    if (quantity > event.available)
      throw new AppError(
        "There are not enough tickets left. Choose a smaller quantity.",
        409,
      );
    const mode = event.sample
      ? "sample"
      : event.price === 0
        ? "free"
        : "stripe";
    const booking: Booking = {
      id: randomUUID(),
      userId,
      eventId,
      quantity,
      total: mode === "sample" ? 0 : quantity * event.price,
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
      requestKey: key,
      stripeAccount: event.ownerId
        ? (await userById(event.ownerId))?.stripeAccount || null
        : null,
    };
    await run(
      "INSERT INTO bookings(id,user_id,event_id,quantity,total,currency,status,mode,code,expires_at,created_at,request_key,stripe_account) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      booking.id,
      userId,
      eventId,
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
    await run(
      "UPDATE bookings SET status='confirmed',session_id=? WHERE id=?",
      session.id,
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
export async function checkIn(code: string, ownerId: string) {
  return transaction(async () => {
    const booking = await one<Booking>(
      "SELECT " + bookingColumns + " FROM bookings WHERE code=? FOR UPDATE",
      code,
    );
    if (!booking || (await getEvent(booking.eventId))?.ownerId !== ownerId)
      throw new AppError("Ticket not found for one of your events.", 404);
    if (booking.status !== "confirmed")
      throw new AppError("This ticket is not valid for entry.", 409);
    if (booking.checkedIn)
      throw new AppError("This booking has already been checked in.", 409);
    await run("UPDATE bookings SET checked_in=? WHERE id=?", Date.now(), booking.id);
    return {
      quantity: booking.quantity,
      event: (await getEvent(booking.eventId))!.title,
      name: (await userById(booking.userId))!.name,
    };
  });
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
    listEvents(),
    all<Booking & { name: string; email: string }>(
    "SELECT " +
      bookingColumns
        .split(", ")
        .map((c) => "b." + c)
        .join(", ") +
      ",u.name,u.email FROM bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id WHERE e.owner_id=? ORDER BY b.created_at DESC",
      userId,
    ),
  ]);
  const events = allEvents.filter((event) => event.ownerId === userId);
  return { events, bookings };
}
export async function takeRateLimit(key: string, max: number, duration = 900000) {
  const now = Date.now();
  const result = await one<{ count: number }>(
    "INSERT INTO rate_limits(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at <= ? THEN 1 ELSE count+1 END, resets_at=CASE WHEN resets_at <= ? THEN ? ELSE resets_at END RETURNING count",
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
