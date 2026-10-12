import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { categories, imageOptions, seedEvents } from "./catalog.ts";
import { AppError, integer, textField } from "./security.ts";
import type { Booking, Event, User, Category, Ticket } from "./types.ts";

let connection: DatabaseSync | undefined;
export function db() {
  if (connection) return connection;
  const file = process.env.DATABASE_PATH || resolve("data/evently.sqlite");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  connection = new DatabaseSync(file);
  connection.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, interests TEXT NOT NULL DEFAULT '[]', stripe_account TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, owner_id TEXT REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS saved (user_id TEXT REFERENCES users(id), event_id TEXT REFERENCES events(id), PRIMARY KEY(user_id,event_id));
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL REFERENCES events(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10), total INTEGER NOT NULL CHECK(total >= 0), currency TEXT NOT NULL, status TEXT NOT NULL, mode TEXT NOT NULL, code TEXT NOT NULL UNIQUE, session_id TEXT UNIQUE, checkout_url TEXT, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, checked_in INTEGER NOT NULL DEFAULT 0, request_key TEXT NOT NULL UNIQUE, stripe_account TEXT);
    CREATE INDEX IF NOT EXISTS bookings_event_status ON bookings(event_id,status);
    CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS account_tokens_user ON account_tokens(user_id,purpose);
    CREATE TABLE IF NOT EXISTS music_connections (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, credentials TEXT NOT NULL, consent_at INTEGER NOT NULL, PRIMARY KEY(user_id,provider));
    CREATE TABLE IF NOT EXISTS music_profiles (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,provider));
    CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_hash TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `);
  if (
    !all<{ name: string }>("PRAGMA table_info(users)").some(
      (column) => column.name === "email_verified_at",
    )
  )
    connection.exec(
      "ALTER TABLE users ADD COLUMN email_verified_at INTEGER NOT NULL DEFAULT 0",
    );
  if (
    !all<{ name: string }>("PRAGMA table_info(bookings)").some(
      (column) => column.name === "refund_requested",
    )
  ) {
    connection.exec(
      "ALTER TABLE bookings ADD COLUMN refund_requested INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (
    process.env.SEED_DEMO !== "false" &&
    !one<{ n: number }>("SELECT COUNT(*) AS n FROM events")?.n
  ) {
    for (const event of seedEvents())
      run(
        "INSERT INTO events(id,slug,owner_id,data) VALUES(?,?,?,?)",
        event.id,
        event.slug,
        null,
        JSON.stringify(event),
      );
  }
  return connection;
}
export function one<T>(sql: string, ...values: SQLInputValue[]) {
  const row = db()
    .prepare(sql)
    .get(...values);
  // node:sqlite rows have a null prototype; React server-to-client props must be plain objects.
  return row ? ({ ...row } as T) : undefined;
}
export function all<T>(sql: string, ...values: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .all(...values)
    .map((row) => ({ ...row }) as T);
}
export function run(sql: string, ...values: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...values);
}
export function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db().exec("COMMIT");
    return result;
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
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
export function userById(id: string) {
  return publicUser(
    one<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", id),
  );
}
function hydrateEvent(row: { data: string }): Event {
  const event = JSON.parse(row.data) as Event;
  if (event.sample && event.id === "sample-1" && !event.genres)
    event.genres = ["Electronic", "House"];
  const reserved =
    one<{ quantity: number }>(
      "SELECT COALESCE(SUM(quantity),0) AS quantity FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",
      event.id,
    )?.quantity || 0;
  return { ...event, available: Math.max(0, event.capacity - reserved) };
}
export function listEvents() {
  return all<{ data: string }>("SELECT data FROM events")
    .map(hydrateEvent)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export function getEvent(id: string) {
  const row = one<{ data: string }>(
    "SELECT data FROM events WHERE id=? OR slug=?",
    id,
    id,
  );
  return row ? hydrateEvent(row) : null;
}
export function savedIds(userId: string) {
  return all<{ event_id: string }>(
    "SELECT event_id FROM saved WHERE user_id=?",
    userId,
  ).map((r) => r.event_id);
}
export function saveEvent(userId: string, eventId: string, saved: boolean) {
  if (!getEvent(eventId)) throw new AppError("Event not found.", 404);
  if (saved)
    run(
      "INSERT OR IGNORE INTO saved(user_id,event_id) VALUES(?,?)",
      userId,
      eventId,
    );
  else run("DELETE FROM saved WHERE user_id=? AND event_id=?", userId, eventId);
  return savedIds(userId);
}
export function updateInterests(userId: string, value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some((v) => !categories.some((c) => c.id === v))
  )
    throw new AppError("Choose valid interests.");
  const interests = [...new Set(value)];
  run(
    "UPDATE users SET interests=? WHERE id=?",
    JSON.stringify(interests),
    userId,
  );
  return userById(userId)!;
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
export function createEvent(input: Record<string, unknown>, owner: User) {
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
  run(
    "INSERT INTO events(id,slug,owner_id,data) VALUES(?,?,?,?)",
    id,
    slug,
    owner.id,
    JSON.stringify(event),
  );
  return event;
}
const bookingColumns =
  "id, user_id AS userId, event_id AS eventId, quantity, total, currency, status, mode, code, session_id AS sessionId, checkout_url AS checkoutUrl, expires_at AS expiresAt, created_at AS createdAt, checked_in AS checkedIn, request_key AS requestKey, stripe_account AS stripeAccount, refund_requested AS refundRequested";
export function bookingById(id: string) {
  return one<Booking>(
    "SELECT " + bookingColumns + " FROM bookings WHERE id=?",
    id,
  );
}
export function listTickets(userId: string): Ticket[] {
  return all<Booking>(
    "SELECT " +
      bookingColumns +
      " FROM bookings WHERE user_id=? ORDER BY created_at DESC",
    userId,
  ).map((b) => ({ ...b, event: getEvent(b.eventId)! }));
}
export function reserveBooking(
  userId: string,
  eventId: string,
  quantity: number,
  nonce: string,
): Booking {
  integer(quantity, "Quantity", 1, 10);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(nonce))
    throw new AppError("Invalid booking request. Refresh and try again.");
  return transaction(() => {
    const key = userId + ":" + nonce;
    const existing = one<Booking>(
      "SELECT " + bookingColumns + " FROM bookings WHERE request_key=?",
      key,
    );
    if (existing) {
      if (existing.eventId !== eventId || existing.quantity !== quantity)
        throw new AppError("This booking request has already been used.", 409);
      return existing;
    }
    const pending = one<Booking>(
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
    const event = getEvent(eventId);
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
        ? userById(event.ownerId)?.stripeAccount || null
        : null,
    };
    run(
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
export function attachCheckout(
  id: string,
  sessionId: string,
  url: string | null,
) {
  run(
    "UPDATE bookings SET session_id=?, checkout_url=? WHERE id=? AND (session_id IS NULL OR session_id=?)",
    sessionId,
    url,
    id,
    sessionId,
  );
}
export function confirmPayment(
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
  transaction(() => {
    const booking = session.client_reference_id
      ? bookingById(session.client_reference_id)
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
    run(
      "UPDATE bookings SET status='confirmed',session_id=? WHERE id=?",
      session.id,
      booking.id,
    );
  });
}
export function expireBooking(sessionId: string, bookingId?: string) {
  run(
    "UPDATE bookings SET status='expired',session_id=COALESCE(session_id,?) WHERE status='pending' AND (session_id=? OR (id=? AND session_id IS NULL))",
    sessionId,
    sessionId,
    bookingId || "",
  );
}
export function cancelFreeBooking(id: string, userId: string) {
  const booking = bookingById(id);
  if (!booking || booking.userId !== userId)
    throw new AppError("Booking not found.", 404);
  if (booking.mode === "stripe")
    throw new AppError("Paid bookings are refunded by the organizer.");
  if (booking.checkedIn)
    throw new AppError("A checked-in booking cannot be cancelled.", 409);
  if (Date.parse(getEvent(booking.eventId)!.startsAt) <= Date.now())
    throw new AppError("This event has already started.", 409);
  run(
    "UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'",
    id,
  );
}
export function checkIn(code: string, ownerId: string) {
  return transaction(() => {
    const booking = one<Booking>(
      "SELECT " + bookingColumns + " FROM bookings WHERE code=?",
      code,
    );
    if (!booking || getEvent(booking.eventId)?.ownerId !== ownerId)
      throw new AppError("Ticket not found for one of your events.", 404);
    if (booking.status !== "confirmed")
      throw new AppError("This ticket is not valid for entry.", 409);
    if (booking.checkedIn)
      throw new AppError("This booking has already been checked in.", 409);
    run("UPDATE bookings SET checked_in=? WHERE id=?", Date.now(), booking.id);
    return {
      quantity: booking.quantity,
      event: getEvent(booking.eventId)!.title,
      name: userById(booking.userId)!.name,
    };
  });
}
export function requestRefund(id: string, userId: string) {
  const booking = bookingById(id);
  if (!booking || booking.userId !== userId)
    throw new AppError("Booking not found.", 404);
  if (booking.mode !== "stripe" || booking.status !== "confirmed")
    throw new AppError(
      "Only confirmed paid bookings can request a refund.",
      409,
    );
  run(
    "UPDATE bookings SET refund_requested=? WHERE id=? AND refund_requested=0",
    Date.now(),
    id,
  );
  return bookingById(id)!;
}
export function organizerData(userId: string) {
  const events = listEvents().filter((e) => e.ownerId === userId);
  const bookings = all<Booking & { name: string; email: string }>(
    "SELECT " +
      bookingColumns
        .split(", ")
        .map((c) => "b." + c)
        .join(", ") +
      ",u.name,u.email FROM bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id WHERE e.owner_id=? ORDER BY b.created_at DESC",
    userId,
  );
  return { events, bookings };
}
export function takeRateLimit(key: string, max: number, duration = 900000) {
  const now = Date.now();
  const result = one<{ count: number }>(
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

export function discoveryData() {
  const now = Date.now();
  return {
    now,
    events: listEvents().filter((e) => Date.parse(e.startsAt) > now),
  };
}
