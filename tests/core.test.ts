import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { hashPassword, checkPassword } from "../src/lib/security.ts";
import { safeNext } from "../src/lib/format.ts";
import { localDateTime, zonedToIso } from "../src/lib/dates.ts";
import { seedEvents } from "../src/lib/catalog.ts";
import { recommend } from "../src/lib/recommendations.ts";
import {
  run,
  createEvent,
  reserveBooking,
  confirmPayment,
  bookingById,
  getEvent,
  checkIn,
  cancelFreeBooking,
  organizerData,
  expireBooking,
  saveEvent,
  savedIds,
  requestRefund,
} from "../src/lib/db.ts";
import type { User } from "../src/lib/types.ts";
process.env.DATABASE_PATH = ":memory:";
process.env.SEED_DEMO = "false";
const owner: User = {
  id: "owner",
  name: "Organizer",
  email: "organizer@example.test",
  interests: [],
  stripeAccount: "acct_owner",
  emailVerified: true,
};
const guest: User = {
  id: "guest",
  name: "Guest",
  email: "guest@example.test",
  interests: [],
  stripeAccount: null,
  emailVerified: true,
};
for (const user of [owner, guest])
  run(
    "INSERT INTO users(id,name,email,password_hash,stripe_account,created_at) VALUES(?,?,?,?,?,?)",
    user.id,
    user.name,
    user.email,
    "unused",
    user.stripeAccount,
    Date.now(),
  );
function eventInput(price = 0, capacity = 3) {
  return {
    title: "Community testing evening",
    description:
      "A meaningful community event with talks, activities and good company.",
    category: "community",
    city: "London",
    venue: "Test Hall",
    address: "1 Test Road, London",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    timezone: "Europe/London",
    price,
    currency: "gbp",
    capacity,
    image: "community",
  };
}
test("passwords use independent salted hashes and verify without trimming", async () => {
  const first = await hashPassword("correct horse battery");
  const second = await hashPassword("correct horse battery");
  assert.notEqual(first, second);
  assert.equal(await checkPassword("correct horse battery", first), true);
  assert.equal(await checkPassword("incorrect", first), false);
  assert.equal(await checkPassword("correct horse battery ", first), false);
});
test("return destinations reject external, protocol-relative and control-character URLs", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\n/evil.test",
    "javascript:alert(1)",
  ])
    assert.equal(safeNext(value), "/account");
  assert.equal(safeNext("/events?category=music"), "/events?category=music");
});
test("event times respect timezone and DST gaps", () => {
  assert.equal(
    zonedToIso("2027-07-01T18:00", "Europe/London"),
    "2027-07-01T17:00:00.000Z",
  );
  assert.equal(
    localDateTime("2027-01-01T18:00:00Z", "Europe/London"),
    "2027-01-01T18:00",
  );
  assert.throws(
    () => zonedToIso("2027-03-28T01:30", "Europe/London"),
    /doesn’t exist/,
  );
});
test("recommendations rank interests and exclude booked and past events", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const events = seedEvents(now);
  const result = recommend(events, ["music"], [], [], now.getTime());
  assert.equal(result[0].event.category, "music");
  assert.equal(result[0].reason, "Matches your interests");
  assert.equal(
    recommend(events, ["music"], [], ["sample-1"], now.getTime()).some(
      (r) => r.event.id === "sample-1",
    ),
    false,
  );
  assert.equal(
    recommend(events, [], [], [], now.getTime() + 100 * 86400000).length,
    0,
  );
});
test("reservation totals are server-derived, idempotent and cannot oversell", () => {
  const event = createEvent(eventInput(0, 2), owner);
  const nonce = randomUUID();
  const booking = reserveBooking(guest.id, event.id, 2, nonce);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.total, 0);
  assert.equal(reserveBooking(guest.id, event.id, 2, nonce).id, booking.id);
  assert.equal(getEvent(event.id)?.available, 0);
  assert.throws(
    () => reserveBooking(owner.id, event.id, 1, randomUUID()),
    /not enough/,
  );
  assert.throws(
    () => reserveBooking(guest.id, event.id, 1, nonce),
    /already been used/,
  );
  assert.throws(
    () => reserveBooking(guest.id, event.id, -1, randomUUID()),
    /invalid/,
  );
});
test("cancelling free reservations releases capacity and respects ownership", () => {
  const event = createEvent(eventInput(0, 2), owner);
  const booking = reserveBooking(guest.id, event.id, 2, randomUUID());
  assert.throws(() => cancelFreeBooking(booking.id, owner.id), /not found/);
  cancelFreeBooking(booking.id, guest.id);
  assert.equal(getEvent(event.id)?.available, 2);
  assert.equal(bookingById(booking.id)?.status, "cancelled");
  assert.equal(
    Object.getPrototypeOf(bookingById(booking.id)),
    Object.prototype,
  );
  assert.equal(
    Object.getPrototypeOf(organizerData(owner.id).bookings[0]),
    Object.prototype,
  );
});
test("paid bookings require matching payment amount, account and metadata", () => {
  const event = createEvent(eventInput(1250, 3), owner);
  const booking = reserveBooking(guest.id, event.id, 2, randomUUID());
  assert.equal(booking.total, 2500);
  assert.equal(booking.status, "pending");
  assert.equal(getEvent(event.id)?.available, 1);
  const session = {
    id: "cs_test_" + booking.id,
    client_reference_id: booking.id,
    amount_total: 2500,
    currency: "gbp",
    payment_status: "paid",
    metadata: { booking_id: booking.id },
  };
  assert.throws(
    () => confirmPayment({ ...session, amount_total: 1 }, owner.stripeAccount!),
    /does not match/,
  );
  assert.throws(
    () => confirmPayment(session, "acct_other"),
    /account does not match/,
  );
  confirmPayment(
    { ...session, payment_status: "unpaid" },
    owner.stripeAccount!,
  );
  assert.equal(bookingById(booking.id)?.status, "pending");
  confirmPayment(session, owner.stripeAccount!);
  confirmPayment(session, owner.stripeAccount!);
  assert.equal(bookingById(booking.id)?.status, "confirmed");
  assert.equal(getEvent(event.id)?.available, 1);
  assert.throws(() => checkIn(booking.code, guest.id), /not found/);
  assert.equal(checkIn(booking.code, owner.id).quantity, 2);
  assert.throws(
    () => checkIn(booking.code, owner.id),
    /already been checked in/,
  );
});
test("Stripe expiry releases only pending holds", () => {
  const event = createEvent(eventInput(1000, 1), owner);
  const booking = reserveBooking(guest.id, event.id, 1, randomUUID());
  expireBooking("cs_expired", booking.id);
  assert.equal(bookingById(booking.id)?.status, "expired");
  assert.equal(getEvent(event.id)?.available, 1);
});
test("refund requests require ownership and a confirmed payment and preserve ticket validity", () => {
  const event = createEvent(eventInput(1000, 1), owner);
  const booking = reserveBooking(guest.id, event.id, 1, randomUUID());
  assert.throws(() => requestRefund(booking.id, owner.id), /not found/);
  assert.throws(() => requestRefund(booking.id, guest.id), /confirmed paid/);
  confirmPayment(
    {
      id: "cs_refund_" + booking.id,
      client_reference_id: booking.id,
      amount_total: 1000,
      currency: "gbp",
      payment_status: "paid",
      metadata: { booking_id: booking.id },
    },
    owner.stripeAccount!,
  );
  const requested = requestRefund(booking.id, guest.id);
  assert.ok(requested.refundRequested > 0);
  assert.equal(requested.status, "confirmed");
  assert.equal(
    requestRefund(booking.id, guest.id).refundRequested,
    requested.refundRequested,
  );
  assert.equal(getEvent(event.id)?.available, 0);
  assert.equal(
    organizerData(owner.id).bookings.find((b) => b.id === booking.id)
      ?.refundRequested,
    requested.refundRequested,
  );
});
test("saved lists and organizer data are scoped to their owners", () => {
  const event = createEvent(eventInput(), owner);
  saveEvent(guest.id, event.id, true);
  assert.deepEqual(savedIds(owner.id), []);
  assert.equal(savedIds(guest.id).includes(event.id), true);
  saveEvent(guest.id, event.id, false);
  assert.equal(savedIds(guest.id).includes(event.id), false);
  assert.equal(organizerData(guest.id).events.length, 0);
  assert.ok(organizerData(owner.id).events.length > 0);
});
test("Stripe rejects forged, modified and stale webhook signatures", () => {
  const stripe = new Stripe("sk_test_local_fixture_only");
  const secret = "whsec_local_fixture";
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, signature, secret).id,
    "evt_test",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload + " ", signature, secret),
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload, signature, "wrong_secret"),
  );
  const stale = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: 1,
  });
  assert.throws(() => stripe.webhooks.constructEvent(payload, stale, secret));
});
