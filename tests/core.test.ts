import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { hashPassword, checkPassword } from "../src/lib/security.ts";
import { safeNext } from "../src/lib/format.ts";
import { refundWindowOpen } from "../src/lib/refund-policy.ts";
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
import { prepareTestDatabase } from "./database.ts";
import type { User } from "../src/lib/types.ts";
await prepareTestDatabase("core");
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
  await run(
    "INSERT INTO users(id,name,email,password_hash,stripe_account,created_at) VALUES(?,?,?,?,?,?)",
    user.id,
    user.name,
    user.email,
    "unused",
    user.stripeAccount,
    Date.now(),
  );
const coverImageId = randomUUID();
await run(
  "INSERT INTO event_images(id,owner_id,media_type,bytes,created_at) VALUES(?,?,?,?,?)",
  coverImageId,
  owner.id,
  "image/jpeg",
  Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
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
    coverImage: "/api/event-images/" + coverImageId,
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
test("paid refund deadline includes the seventh day and cancelled events", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const deadline = { startsAt: "2026-11-22T12:00:00Z", visibility: "published" as const };
  assert.equal(refundWindowOpen(deadline, now), true);
  assert.equal(refundWindowOpen(deadline, now + 1), false);
  assert.equal(refundWindowOpen({ ...deadline, visibility: "cancelled" }, now + 1), true);
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
test("reservation totals are server-derived, idempotent and cannot oversell", async () => {
  const event = await createEvent(eventInput(0, 2), owner);
  const nonce = randomUUID();
  const booking = await reserveBooking(guest.id, event.id, 2, nonce);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.total, 0);
  assert.equal(
    (await reserveBooking(guest.id, event.id, 2, nonce)).id,
    booking.id,
  );
  assert.equal((await getEvent(event.id))?.available, 0);
  await assert.rejects(
    reserveBooking(owner.id, event.id, 1, randomUUID()),
    /not enough/,
  );
  await assert.rejects(
    reserveBooking(guest.id, event.id, 1, nonce),
    /already been used/,
  );
  await assert.rejects(
    reserveBooking(guest.id, event.id, -1, randomUUID()),
    /invalid/,
  );
});
test("cancelling free reservations releases capacity and respects ownership", async () => {
  const event = await createEvent(eventInput(0, 2), owner);
  const booking = await reserveBooking(guest.id, event.id, 2, randomUUID());
  await assert.rejects(cancelFreeBooking(booking.id, owner.id), /not found/);
  await cancelFreeBooking(booking.id, guest.id);
  assert.equal((await getEvent(event.id))?.available, 2);
  assert.equal((await bookingById(booking.id))?.status, "cancelled");
  assert.equal(
    Object.getPrototypeOf(await bookingById(booking.id)),
    Object.prototype,
  );
  assert.equal(
    Object.getPrototypeOf((await organizerData(owner.id)).bookings[0]),
    Object.prototype,
  );
});
test("paid bookings require matching payment amount, account and metadata", async () => {
  const event = await createEvent(eventInput(1250, 3), owner);
  const booking = await reserveBooking(guest.id, event.id, 2, randomUUID());
  assert.equal(booking.total, 2500);
  assert.equal(booking.status, "pending");
  assert.equal((await getEvent(event.id))?.available, 1);
  const session = {
    id: "cs_test_" + booking.id,
    client_reference_id: booking.id,
    amount_total: 2500,
    currency: "gbp",
    payment_status: "paid",
    metadata: { booking_id: booking.id },
  };
  await assert.rejects(
    confirmPayment({ ...session, amount_total: 1 }, owner.stripeAccount!),
    /does not match/,
  );
  await assert.rejects(
    confirmPayment(session, "acct_other"),
    /account does not match/,
  );
  await confirmPayment(
    { ...session, payment_status: "unpaid" },
    owner.stripeAccount!,
  );
  assert.equal((await bookingById(booking.id))?.status, "pending");
  await confirmPayment(session, owner.stripeAccount!);
  await confirmPayment(session, owner.stripeAccount!);
  assert.equal((await bookingById(booking.id))?.status, "confirmed");
  assert.equal((await getEvent(event.id))?.available, 1);
  await assert.rejects(checkIn(booking.code, guest.id), /not found/);
  assert.equal((await checkIn(booking.code, owner.id)).quantity, 2);
  await assert.rejects(
    checkIn(booking.code, owner.id),
    /already been checked in/,
  );
});
test("Stripe expiry releases only pending holds", async () => {
  const event = await createEvent(eventInput(1000, 1), owner);
  const booking = await reserveBooking(guest.id, event.id, 1, randomUUID());
  await expireBooking("cs_expired", booking.id);
  assert.equal((await bookingById(booking.id))?.status, "expired");
  assert.equal((await getEvent(event.id))?.available, 1);
});
test("refund requests require ownership and a confirmed payment and preserve ticket validity", async () => {
  const event = await createEvent({
    ...eventInput(1000, 1),
    startsAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 15 * 86400000 + 3600000).toISOString(),
  }, owner);
  const booking = await reserveBooking(guest.id, event.id, 1, randomUUID());
  await assert.rejects(requestRefund(booking.id, owner.id), /not found/);
  await assert.rejects(requestRefund(booking.id, guest.id), /confirmed paid/);
  await confirmPayment(
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
  const requested = await requestRefund(booking.id, guest.id);
  assert.ok(requested.refundRequested > 0);
  assert.equal(requested.status, "confirmed");
  assert.equal(
    (await requestRefund(booking.id, guest.id)).refundRequested,
    requested.refundRequested,
  );
  assert.equal((await getEvent(event.id))?.available, 0);
  assert.equal(
    (await organizerData(owner.id)).bookings.find((b) => b.id === booking.id)
      ?.refundRequested,
    requested.refundRequested,
  );
});
test("saved lists and organizer data are scoped to their owners", async () => {
  const event = await createEvent(eventInput(), owner);
  await saveEvent(guest.id, event.id, true);
  assert.deepEqual(await savedIds(owner.id), []);
  assert.equal((await savedIds(guest.id)).includes(event.id), true);
  await saveEvent(guest.id, event.id, false);
  assert.equal((await savedIds(guest.id)).includes(event.id), false);
  assert.equal((await organizerData(guest.id)).events.length, 0);
  assert.ok((await organizerData(owner.id)).events.length > 0);
});
test("organizer events place upcoming dates before past dates", async () => {
  const upcoming = await createEvent(
    { ...eventInput(), title: "Upcoming organizer gathering" },
    owner,
  );
  const past = await createEvent(
    { ...eventInput(), title: "Past organizer gathering" },
    owner,
  );
  await run(
    "UPDATE events SET data=? WHERE id=?",
    JSON.stringify({
      ...past,
      startsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      endsAt: new Date(Date.now() - 86400000).toISOString(),
    }),
    past.id,
  );
  const events = (await organizerData(owner.id)).events;
  assert.ok(
    events.findIndex((event) => event.id === upcoming.id) <
      events.findIndex((event) => event.id === past.id),
  );
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
