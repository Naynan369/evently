import { randomUUID } from "node:crypto";
import { categories } from "./catalog.ts";
import { all, listEvents, one, run } from "./db.ts";
import { eventIsPrivate } from "./demo.ts";
import { isMessinaArea, isMessinaCity, type MessinaArea } from "./messina.ts";
import { AppError, integer, textField } from "./security.ts";
import type { Category, Event } from "./types.ts";

export type EventIntent = {
  id: string;
  userId: string;
  category: Category;
  area: MessinaArea | "";
  desiredMonth: string;
  maxPriceCents: number;
  partySize: number;
  note: string;
  emailOptIn: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DemandSignal = {
  category: Category;
  area: MessinaArea | "";
  desiredMonth: string;
  attendees: number;
  potentialGuests: number;
  averageBudgetCents: number;
};

const intentColumns = 'id,user_id AS "userId",category,area,desired_month AS "desiredMonth",max_price_cents AS "maxPriceCents",party_size AS "partySize",note,email_opt_in AS "emailOptIn",created_at AS "createdAt",updated_at AS "updatedAt"';

export function eventMonth(isoDate: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit",
  }).formatToParts(new Date(isoDate));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function intentMonthOptions(now = new Date()) {
  const current = eventMonth(now.toISOString());
  const [year, month] = current.split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function validatedIntent(input: Record<string, unknown>) {
  const category = textField(input.category, "Category") as Category;
  if (!categories.some((item) => item.id === category))
    throw new AppError("Choose a valid category.");
  const area = input.area === "" || input.area === undefined ? "" : textField(input.area, "Area");
  if (area && !isMessinaArea(area)) throw new AppError("Choose a Messina area.");
  const desiredMonth = textField(input.desiredMonth, "Month", 7, 7);
  if (!intentMonthOptions().includes(desiredMonth))
    throw new AppError("Choose a month within the next year.");
  const maxPriceCents = integer(input.maxPriceCents, "Budget", 0, 50000);
  const partySize = integer(input.partySize, "Group size", 1, 10);
  const note = input.note === undefined ? "" : textField(input.note, "Idea", 0, 240);
  if (typeof input.emailOptIn !== "boolean")
    throw new AppError("Choose whether to receive matching emails.");
  return { category, area: area as MessinaArea | "", desiredMonth, maxPriceCents, partySize, note, emailOptIn: input.emailOptIn };
}

export async function saveIntent(userId: string, input: Record<string, unknown>, id?: string) {
  const value = validatedIntent(input);
  const now = Date.now();
  if (id) {
    try {
      const updated = await one<EventIntent>(
        `UPDATE event_intents SET category=?,area=?,desired_month=?,max_price_cents=?,party_size=?,note=?,email_opt_in=?,updated_at=?
         WHERE id=? AND user_id=? RETURNING ${intentColumns}`,
        value.category, value.area, value.desiredMonth, value.maxPriceCents,
        value.partySize, value.note, value.emailOptIn, now, id, userId,
      );
      if (!updated) throw new AppError("Idea not found.", 404);
      return updated;
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new AppError("You already saved an idea for this category, area and month.", 409);
      throw error;
    }
  }
  return (await one<EventIntent>(
    `INSERT INTO event_intents(id,user_id,category,area,desired_month,max_price_cents,party_size,note,email_opt_in,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id,category,area,desired_month) DO UPDATE SET
       max_price_cents=EXCLUDED.max_price_cents,party_size=EXCLUDED.party_size,
       note=EXCLUDED.note,email_opt_in=EXCLUDED.email_opt_in,updated_at=EXCLUDED.updated_at
     RETURNING ${intentColumns}`,
    randomUUID(), userId, value.category, value.area, value.desiredMonth,
    value.maxPriceCents, value.partySize, value.note, value.emailOptIn, now, now,
  ))!;
}

export async function deleteIntent(userId: string, id: string) {
  const deleted = await one<{ id: string }>(
    "DELETE FROM event_intents WHERE id=? AND user_id=? RETURNING id", id, userId,
  );
  if (!deleted) throw new AppError("Idea not found.", 404);
}

export async function intentsForUser(userId: string) {
  return all<EventIntent>(
    `SELECT ${intentColumns} FROM event_intents WHERE user_id=? ORDER BY desired_month,created_at DESC`,
    userId,
  );
}

export async function intentById(id: string) {
  return one<EventIntent>(`SELECT ${intentColumns} FROM event_intents WHERE id=?`, id);
}

export function eventMatchesIntent(event: Event, intent: EventIntent) {
  return !eventIsPrivate(event) && !event.sample && isMessinaCity(event.city) &&
    event.currency.toLowerCase() === "eur" &&
    Date.parse(event.startsAt) > Date.now() && event.available > 0 &&
    event.category === intent.category && eventMonth(event.startsAt) === intent.desiredMonth &&
    (!intent.area || event.area === intent.area) && event.price <= intent.maxPriceCents;
}

export async function intentMatchesForUser(userId: string) {
  const [intents, events] = await Promise.all([intentsForUser(userId), listEvents()]);
  return intents.map((intent) => ({
    intentId: intent.id,
    events: events.filter((event) => eventMatchesIntent(event, intent)).slice(0, 3),
  }));
}

export async function demandSignals(): Promise<DemandSignal[]> {
  return all<DemandSignal>(
    `SELECT category,area,desired_month AS "desiredMonth",
       COUNT(DISTINCT user_id)::integer AS attendees,
       SUM(party_size)::integer AS "potentialGuests",
       ROUND(AVG(max_price_cents))::integer AS "averageBudgetCents"
     FROM event_intents WHERE desired_month>=?
     GROUP BY category,area,desired_month
     HAVING COUNT(DISTINCT user_id)>=3
     ORDER BY attendees DESC,desired_month,category`,
    intentMonthOptions()[0],
  );
}

export async function queueIntentMatchesForEvent(event: Event) {
  if (eventIsPrivate(event) || event.sample || !isMessinaCity(event.city) ||
      event.currency.toLowerCase() !== "eur" ||
      Date.parse(event.startsAt) <= Date.now() || event.available < 1) return;
  await run(
    `INSERT INTO message_outbox(id,kind,intent_id,event_id,user_id,created_at)
     SELECT 'intent-match:'||i.id||':'||?, 'intent-match', i.id, ?, i.user_id, ?
     FROM event_intents i
     WHERE i.category=? AND i.desired_month=? AND (i.area='' OR i.area=?)
       AND i.max_price_cents>=? AND i.email_opt_in=TRUE
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id=i.user_id AND b.event_id=? AND b.status='confirmed')
       AND NOT EXISTS (SELECT 1 FROM message_outbox m WHERE m.intent_id=i.id AND m.kind='intent-match' AND m.created_at>?)
     ON CONFLICT(id) DO NOTHING`,
    event.id, event.id, Date.now(), event.category, eventMonth(event.startsAt),
    event.area || "", event.price, event.id, Date.now() - 7 * 86400000,
  );
}
