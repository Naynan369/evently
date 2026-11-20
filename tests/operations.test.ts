import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEvent, getEvent, listEvents, reserveBooking, confirmPayment, bookingById, checkIn, requestRefund, run, one, userById } from "../src/lib/db.ts";
import { changeUserRole, createCase, dispatchMessages, isOperator, moderateEvent, operatorSnapshot, resolveCase } from "../src/lib/operations.ts";
import { prepareTestDatabase } from "./database.ts";
import type { User } from "../src/lib/types.ts";

await prepareTestDatabase("operations");
process.env.APP_URL = "http://127.0.0.1:3100";
process.env.EMAIL_DELIVERY = "preview";
process.env.EMAIL_PREVIEW_DIR = join(tmpdir(), "evently-operations-mail");
process.env.EVENTLY_REQUIRE_EVENT_APPROVAL = "true";

const owner: User = { id: "ops-owner", name: "Organizer", email: "organizer@example.test", role: "USER", interests: [], stripeAccount: "acct_ops", emailVerified: true };
const guest: User = { id: "ops-guest", name: "Guest", email: "guest@example.test", role: "USER", interests: [], stripeAccount: null, emailVerified: true };
const operator: User = { ...guest, id: "ops-operator", email: "operator@example.test", role: "ADMIN" };
for (const user of [owner, guest, operator])
  await run("INSERT INTO users(id,name,email,password_hash,stripe_account,created_at,role,email_verified_at) VALUES(?,?,?,?,?,?,?,?)", user.id, user.name, user.email, "unused", user.stripeAccount, Date.now(), user.role, user.id === operator.id ? Date.now() : 0);
const photo = randomUUID();
await run("INSERT INTO event_images(id,owner_id,media_type,bytes,created_at) VALUES(?,?,?,?,?)", photo, owner.id, "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Date.now());
function input(price: number) {
  return {
    title: "Operations rehearsal " + randomUUID().slice(0, 8),
    description: "A community event with music, conversation and a clear schedule.",
    category: "community", city: "Messina", venue: "Test Hall", address: "1 Test Road, Messina",
    startsAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 15 * 86400000 + 3600000).toISOString(),
    timezone: "Europe/Rome", price, currency: "eur", capacity: 10, image: "community",
    coverImage: "/api/event-images/" + photo,
  };
}

test("a verified stored admin can operate listings", async () => {
  assert.equal(isOperator(operator), true);
  assert.equal(isOperator({ ...operator, emailVerified: false }), false);
  assert.equal(isOperator(guest), false);
  const event = await createEvent(input(0), owner);
  assert.equal(event.visibility, "review");
  assert.equal((await listEvents()).some((item) => item.id === event.id), false);
  await assert.rejects(moderateEvent(event.id, "cancel"), { status: 409 });
  await moderateEvent(event.id, "approve");
  assert.equal((await getEvent(event.id))?.visibility, "published");
  assert.equal((await listEvents()).some((item) => item.id === event.id), true);
  await assert.rejects(moderateEvent(event.id, "approve"), { status: 409 });
});

test("admin roles require a verified account and cannot be self-removed", async () => {
  await assert.rejects(changeUserRole(guest, guest.id, "ADMIN"), { status: 403 });
  await assert.rejects(changeUserRole(operator, guest.id, "ADMIN"), { status: 409 });
  await run("UPDATE users SET email_verified_at=? WHERE id=?", Date.now(), guest.id);
  await changeUserRole(operator, guest.id, "ADMIN");
  assert.equal((await userById(guest.id))?.role, "ADMIN");
  assert.equal(isOperator(await userById(guest.id)), true);
  const promoted = (await userById(guest.id))!;
  await assert.rejects(changeUserRole(promoted, guest.id, "USER"), { status: 409 });
  await changeUserRole(operator, guest.id, "USER");
  assert.equal((await userById(guest.id))?.role, "USER");
  await assert.rejects(changeUserRole(operator, operator.id, "USER"), { status: 409 });
});

test("cancellation invalidates entry, queues notice and exposes paid refunds", async () => {
  const event = await createEvent(input(1500), owner);
  await moderateEvent(event.id, "approve");
  const booking = await reserveBooking(guest.id, event.id, 1, randomUUID());
  await confirmPayment({
    id: "cs_test_" + booking.id, client_reference_id: booking.id,
    amount_total: 1500, currency: "eur", payment_status: "paid",
    metadata: { booking_id: booking.id },
  }, owner.stripeAccount!);
  await moderateEvent(event.id, "cancel");
  await assert.rejects(checkIn(booking.code, owner.id), { status: 409 });
  await requestRefund(booking.id, guest.id);
  assert.ok((await bookingById(booking.id))?.refundRequested);
  assert.equal((await operatorSnapshot()).refundRequests.some((row) => row.id === booking.id), true);
  assert.equal((await one<{ n: number }>("SELECT COUNT(*)::integer AS n FROM message_outbox WHERE id=?", "event-cancelled:" + booking.id))?.n, 1);
  const sent = await dispatchMessages();
  assert.equal(sent.sent, 1);
  assert.equal((await one<{ status: string }>("SELECT status FROM message_outbox WHERE id=?", "booking-confirmed:" + booking.id))?.status, "skipped");
});

test("operator cases can be tracked and resolved", async () => {
  const id = await createCase({ kind: "incident", subject: "Venue access issue", details: "The entrance was closed at arrival.", reporterId: guest.id });
  assert.equal((await operatorSnapshot()).cases.find((item) => item.id === id)?.status, "open");
  await resolveCase(id, "resolved");
  assert.equal((await operatorSnapshot()).cases.find((item) => item.id === id)?.status, "resolved");
});

test("a payment completed after cancellation enters the refund queue", async () => {
  const event = await createEvent(input(1800), owner);
  await moderateEvent(event.id, "approve");
  const booking = await reserveBooking(guest.id, event.id, 1, randomUUID());
  await moderateEvent(event.id, "cancel");
  assert.equal((await operatorSnapshot()).pendingCancellations.some((item) => item.id === booking.id), true);
  await confirmPayment({
    id: "cs_late_" + booking.id, client_reference_id: booking.id,
    amount_total: 1800, currency: "eur", payment_status: "paid",
    metadata: { booking_id: booking.id },
  }, owner.stripeAccount!);
  assert.equal((await bookingById(booking.id))?.status, "confirmed");
  assert.equal((await operatorSnapshot()).pendingCancellations.some((item) => item.id === booking.id), false);
  assert.equal((await one<{ n: number }>("SELECT COUNT(*)::integer AS n FROM message_outbox WHERE id=?", "booking-confirmed:" + booking.id))?.n, 0);
  assert.equal((await one<{ n: number }>("SELECT COUNT(*)::integer AS n FROM message_outbox WHERE id=?", "event-cancelled:" + booking.id))?.n, 1);
  assert.equal((await operatorSnapshot()).cases.some((item) => item.bookingId === booking.id && item.status === "open"), true);
});
