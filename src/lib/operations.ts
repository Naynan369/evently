import { randomUUID } from "node:crypto";
import { all, bookingById, getEvent, one, run, transaction, userById } from "./db.ts";
import { applicationOrigin, emailDeliveryMode, sendOperationalEmail } from "./mail.ts";
import { AppError, textField } from "./security.ts";
import { eventMatchesIntent, intentById, queueIntentMatchesForEvent } from "./intents.ts";
import type { Event, User } from "./types.ts";

export type OperatorCase = {
  id: string;
  kind: "incident" | "payment" | "dispute";
  subject: string;
  details: string;
  status: "open" | "resolved";
  eventId: string | null;
  bookingId: string | null;
  reporterId: string | null;
  reporterEmail: string | null;
  eventTitle: string | null;
  createdAt: number;
  updatedAt: number;
};

export function isOperator(user: User | null) {
  const emails = (process.env.EVENTLY_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(user?.emailVerified && emails.includes(user.email.toLowerCase()));
}

export function assertOperator(user: User | null): asserts user is User {
  if (!isOperator(user)) throw new AppError("Operator access is required.", 403);
}

const caseColumns = 'c.id,c.kind,c.subject,c.details,c.status,c.event_id AS "eventId",c.booking_id AS "bookingId",c.reporter_id AS "reporterId",u.email AS "reporterEmail",e.data::jsonb->>\'title\' AS "eventTitle",c.created_at AS "createdAt",c.updated_at AS "updatedAt"';

export async function operatorSnapshot() {
  const [eventRows, cases, pendingMessages, exceptions, messageIssues, pendingCancellations] = await Promise.all([
    all<{ data: string }>("SELECT data FROM events WHERE owner_id IS NOT NULL ORDER BY id DESC"),
    all<OperatorCase>(`SELECT ${caseColumns} FROM operator_cases c LEFT JOIN users u ON u.id=c.reporter_id LEFT JOIN events e ON e.id=c.event_id ORDER BY CASE c.status WHEN 'open' THEN 0 ELSE 1 END, c.created_at DESC LIMIT 100`),
    one<{ count: number }>("SELECT COUNT(*)::integer AS count FROM message_outbox WHERE status IN ('pending','failed')"),
    all<{ id: string; eventTitle: string; createdAt: number; email: string }>(
      `SELECT b.id,e.data::jsonb->>'title' AS "eventTitle",b.created_at AS "createdAt",u.email
       FROM bookings b JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.user_id
       WHERE b.status='confirmed' AND b.mode='stripe'
         AND (b.refund_requested>0 OR e.data::jsonb->>'visibility'='cancelled')
       ORDER BY GREATEST(b.refund_requested,b.created_at) DESC LIMIT 40`,
    ),
    all<{ id: string; kind: string; email: string; attempts: number; lastError: string | null }>(
      `SELECT m.id,m.kind,u.email,m.attempts,m.last_error AS "lastError"
       FROM message_outbox m JOIN users u ON u.id=m.user_id
       WHERE m.status='failed' ORDER BY m.created_at DESC LIMIT 30`,
    ),
    all<{ id: string; eventTitle: string; email: string }>(
      `SELECT b.id,e.data::jsonb->>'title' AS "eventTitle",u.email
       FROM bookings b JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.user_id
       WHERE b.status='pending' AND b.mode='stripe' AND e.data::jsonb->>'visibility'='cancelled'
       ORDER BY b.created_at DESC LIMIT 40`,
    ),
  ]);
  return {
    events: eventRows.map((row) => JSON.parse(row.data) as Event),
    cases,
    pendingMessages: pendingMessages?.count || 0,
    refundRequests: exceptions,
    messageIssues,
    pendingCancellations,
  };
}

export async function retryFailedMessages() {
  await run("UPDATE message_outbox SET attempts=0,last_attempt_at=NULL,status='pending' WHERE status='failed'");
  return dispatchMessages(20);
}

export async function createCase(input: {
  kind: OperatorCase["kind"];
  subject: unknown;
  details: unknown;
  eventId?: string;
  bookingId?: string;
  reporterId?: string;
}) {
  if (!["incident", "payment", "dispute"].includes(input.kind))
    throw new AppError("Choose a valid report type.");
  const subject = textField(input.subject, "Subject", 5, 120);
  const details = textField(input.details, "Details", 10, 3000);
  if (input.eventId && !(await getEvent(input.eventId)))
    throw new AppError("Event not found.", 404);
  if (input.bookingId && !(await bookingById(input.bookingId)))
    throw new AppError("Booking not found.", 404);
  const id = randomUUID();
  await run(
    "INSERT INTO operator_cases(id,kind,subject,details,status,event_id,booking_id,reporter_id,created_at,updated_at) VALUES(?,?,?,?,'open',?,?,?,?,?)",
    id, input.kind, subject, details, input.eventId || null,
    input.bookingId || null, input.reporterId || null, Date.now(), Date.now(),
  );
  return id;
}

export async function resolveCase(id: string, status: "open" | "resolved") {
  if (status !== "open" && status !== "resolved") throw new AppError("Invalid case status.");
  const result = await one<{ id: string }>(
    "UPDATE operator_cases SET status=?,updated_at=? WHERE id=? RETURNING id",
    status, Date.now(), id,
  );
  if (!result) throw new AppError("Case not found.", 404);
}

export async function moderateEvent(id: string, action: "approve" | "reject" | "cancel") {
  if (!["approve", "reject", "cancel"].includes(action))
    throw new AppError("Invalid review action.");
  return transaction(async () => {
    const row = await one<{ data: string }>("SELECT data FROM events WHERE id=? AND owner_id IS NOT NULL FOR UPDATE", id);
    if (!row) throw new AppError("Event not found.", 404);
    const event = JSON.parse(row.data) as Event;
    const reserved = await one<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')", id,
    );
    if (action === "approve" && !["review", "rejected"].includes(event.visibility || ""))
      throw new AppError("Only a listing awaiting review can be approved.", 409);
    if (action === "reject" && event.visibility !== "review")
      throw new AppError("Only a listing awaiting review can be rejected.", 409);
    if (action === "reject" && (reserved?.count || 0) > 0)
      throw new AppError("Resolve existing bookings before rejecting this event.", 409);
    if (action === "cancel" && event.visibility === "cancelled") return event;
    if (action === "cancel" && event.visibility !== "published")
      throw new AppError("Only a published event can be cancelled.", 409);
    const visibility = action === "approve" ? "published" : action === "reject" ? "rejected" : "cancelled";
    const updated: Event = { ...event, visibility };
    await run("UPDATE events SET data=? WHERE id=?", JSON.stringify(updated), id);
    if (action === "approve") await queueIntentMatchesForEvent(updated);
    if (action === "cancel") {
      await run(
        `INSERT INTO message_outbox(id,kind,booking_id,user_id,created_at)
         SELECT 'event-cancelled:'||b.id,'event-cancelled',b.id,b.user_id,?
         FROM bookings b WHERE b.event_id=? AND b.status='confirmed' ON CONFLICT(id) DO NOTHING`,
        Date.now(), id,
      );
      const paid = await all<{ id: string }>(
        "SELECT id FROM bookings WHERE event_id=? AND status='confirmed' AND mode='stripe'", id,
      );
      for (const booking of paid)
        await run(
          "INSERT INTO operator_cases(id,kind,subject,details,status,event_id,booking_id,created_at,updated_at) VALUES(?,?,?,?,'open',?,?,?,?) ON CONFLICT(id) DO NOTHING",
          "cancellation-refund:" + booking.id, "payment", "Refund after event cancellation",
          "Review and issue a full refund for this cancelled event.", id, booking.id, Date.now(), Date.now(),
        );
    }
    return updated;
  });
}

export async function dispatchMessages(limit = 20) {
  if (emailDeliveryMode() === "unavailable") return { sent: 0, failed: 0, unavailable: true };
  const rows = await all<{ id: string }>(
    "SELECT id FROM message_outbox WHERE status IN ('pending','failed') AND attempts<5 AND (last_attempt_at IS NULL OR last_attempt_at<?) ORDER BY created_at LIMIT ?",
    Date.now() - 5 * 60000, limit,
  );
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    await transaction(async () => {
      const message = await one<{ id: string; kind: string; bookingId: string | null; intentId: string | null; eventId: string | null; userId: string }>(
        'SELECT id,kind,booking_id AS "bookingId",intent_id AS "intentId",event_id AS "eventId",user_id AS "userId" FROM message_outbox WHERE id=? AND status IN (\'pending\',\'failed\') AND attempts<5 FOR UPDATE SKIP LOCKED',
        row.id,
      );
      if (!message) return;
      const recipient = await userById(message.userId);
      if (!recipient) {
        await run("UPDATE message_outbox SET status='skipped',last_error='Message no longer applies' WHERE id=?", message.id);
        return;
      }
      let subject: string;
      let text: string;
      if (message.kind === "intent-match") {
        const intent = message.intentId ? await intentById(message.intentId) : null;
        const event = message.eventId ? await getEvent(message.eventId) : null;
        if (!intent || !event || intent.userId !== recipient.id || !intent.emailOptIn || !eventMatchesIntent(event, intent)) {
          await run("UPDATE message_outbox SET status='skipped',last_error='Match no longer applies' WHERE id=?", message.id);
          return;
        }
        subject = "An event matching your idea is live";
        text = `Hi ${recipient.name},\n\n${event.title} is now on Evently. It matches the event idea you saved for ${intent.desiredMonth} in Messina. See the details and current ticket availability: ${applicationOrigin()}/events/${event.slug}\n\nThis is a suggestion, not a reservation. You can change your email preference or remove the idea at ${applicationOrigin()}/intent.\n\nEvently`;
      } else {
        const booking = message.bookingId ? await bookingById(message.bookingId) : null;
        const event = booking ? await getEvent(booking.eventId) : null;
        if (!booking || !event ||
          (message.kind === "booking-confirmed" && (booking.status !== "confirmed" || event.visibility === "cancelled")) ||
          (message.kind === "refund-issued" && booking.status !== "refunded")) {
          await run("UPDATE message_outbox SET status='skipped',last_error='Message no longer applies' WHERE id=?", message.id);
          return;
        }
        const cancelled = message.kind === "event-cancelled";
        const bookingCancelled = message.kind === "booking-cancelled";
        const refunded = message.kind === "refund-issued";
        subject = cancelled ? `Event cancelled: ${event.title}` :
          bookingCancelled ? `Booking cancelled: ${event.title}` :
          refunded ? `Refund issued: ${event.title}` : `Booking confirmed: ${event.title}`;
        text = cancelled
          ? `Hi ${recipient.name},\n\n${event.title} has been cancelled. Your ticket is no longer valid. If you paid, a full refund is due; check your ticket and contact Evently if it has not been issued.\n\nEvently`
          : bookingCancelled
            ? `Hi ${recipient.name},\n\nYour booking for ${event.title} has been cancelled.\n\nEvently`
            : refunded
              ? `Hi ${recipient.name},\n\nA refund has been issued for ${event.title}. Your ticket is no longer valid.\n\nEvently`
              : `Hi ${recipient.name},\n\nYour ${booking.quantity} ${booking.ticketType} ticket${booking.quantity === 1 ? " is" : "s are"} confirmed for ${event.title}. View your booking at ${applicationOrigin()}/tickets/${booking.id}.\n\nEvently`;
      }
      try {
        await sendOperationalEmail({ id: message.id, to: recipient.email, subject, text });
        await run("UPDATE message_outbox SET status='sent',attempts=attempts+1,last_error=NULL,last_attempt_at=?,sent_at=? WHERE id=?", Date.now(), Date.now(), message.id);
        sent++;
      } catch (error) {
        await run("UPDATE message_outbox SET status='failed',attempts=attempts+1,last_error=?,last_attempt_at=? WHERE id=?", error instanceof Error ? error.message.slice(0, 300) : "Delivery failed", Date.now(), message.id);
        failed++;
      }
    });
  }
  return { sent, failed, unavailable: false };
}

export async function deliverMessagesBestEffort(limit = 5) {
  try {
    return await dispatchMessages(limit);
  } catch (error) {
    console.error("Evently message delivery attempt failed:", error);
    return { sent: 0, failed: 0, unavailable: true };
  }
}
