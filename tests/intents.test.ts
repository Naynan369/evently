import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createEvent, one, run } from "../src/lib/db.ts";
import { deleteIntent, demandSignals, eventMatchesIntent, eventMonth, intentMatchesForUser, intentsForUser, queueIntentMatchesForEvent, saveIntent } from "../src/lib/intents.ts";
import { dispatchMessages, moderateEvent } from "../src/lib/operations.ts";
import { prepareTestDatabase } from "./database.ts";
import type { User } from "../src/lib/types.ts";

await prepareTestDatabase("intents");
process.env.APP_URL = "http://127.0.0.1:3100";
process.env.EMAIL_DELIVERY = "preview";
process.env.EMAIL_PREVIEW_DIR = "/private/tmp/evently-intent-mail";
process.env.EVENTLY_ORGANIZER_DEMO = "false";
process.env.EVENTLY_REQUIRE_EVENT_APPROVAL = "true";

const owner: User = { id: "intent-owner", name: "Organizer", email: "intent-owner@example.test", role: "USER", interests: [], stripeAccount: null, emailVerified: true };
const guests: User[] = [0, 1, 2, 3].map((index) => ({
  id: `intent-guest-${index}`, name: `Guest ${index}`, email: `intent-guest-${index}@example.test`,
  role: "USER", interests: [], stripeAccount: null, emailVerified: true,
}));
for (const user of [owner, ...guests])
  await run("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)", user.id, user.name, user.email, "unused", Date.now());
const photo = randomUUID();
await run("INSERT INTO event_images(id,owner_id,media_type,bytes,created_at) VALUES(?,?,?,?,?)", photo, owner.id, "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Date.now());
const start = new Date(Date.now() + 40 * 86400000).toISOString();
const end = new Date(Date.now() + 40 * 86400000 + 3600000).toISOString();
const month = eventMonth(start);
const idea = (emailOptIn: boolean, area = "centro", maxPriceCents = 3000) => ({
  category: "music", area, desiredMonth: month, maxPriceCents,
  partySize: 2, note: "Live music with good company", emailOptIn,
});

test("demand is anonymous and hidden until three distinct attendees agree", async () => {
  await saveIntent(guests[0].id, idea(true));
  await saveIntent(guests[1].id, idea(false));
  assert.deepEqual(await demandSignals(), []);
  await saveIntent(guests[2].id, idea(true));
  await saveIntent(guests[3].id, idea(true, "nord"));
  const signals = await demandSignals();
  assert.equal(signals.length, 1);
  assert.equal(signals[0].attendees, 3);
  assert.equal(signals[0].potentialGuests, 6);
  assert.equal("email" in signals[0], false);
  assert.equal("note" in signals[0], false);
  const updated = await saveIntent(guests[0].id, { ...idea(true), maxPriceCents: 3500 });
  assert.equal(updated.maxPriceCents, 3500);
  assert.equal((await intentsForUser(guests[0].id)).length, 1);
  await assert.rejects(deleteIntent(guests[1].id, updated.id), { status: 404 });
});

test("approval matches category, area, month and budget; email consent is rechecked at delivery", async () => {
  const event = await createEvent({
    title: "Live music in the centre", description: "A live music night with a thoughtful local lineup and time to meet people.",
    category: "music", city: "Messina", area: "centro", venue: "Test Hall", address: "1 Test Road, Messina",
    startsAt: start, endsAt: end, timezone: "Europe/Rome", price: 2000, currency: "eur", capacity: 20,
    image: "community", coverImage: `/api/event-images/${photo}`,
  }, owner);
  assert.equal(event.visibility, "review");
  assert.equal((await intentMatchesForUser(guests[0].id))[0].events.length, 0);
  await moderateEvent(event.id, "approve");
  assert.equal((await intentMatchesForUser(guests[0].id))[0].events[0]?.id, event.id);
  const firstIntent = (await intentsForUser(guests[0].id))[0];
  assert.equal(eventMatchesIntent({ ...event, visibility: "published", currency: "usd" }, firstIntent), false);
  await queueIntentMatchesForEvent({ ...event, visibility: "published", currency: "usd" });
  assert.equal((await intentMatchesForUser(guests[1].id))[0].events[0]?.id, event.id);
  assert.equal((await intentMatchesForUser(guests[3].id))[0].events.length, 0);
  assert.equal((await one<{ n: number }>("SELECT COUNT(*)::integer AS n FROM message_outbox WHERE kind='intent-match'"))?.n, 2);
  const third = (await intentsForUser(guests[2].id))[0];
  await saveIntent(guests[2].id, { ...idea(false), note: third.note }, third.id);
  const delivery = await dispatchMessages();
  assert.equal(delivery.sent, 1);
  assert.equal((await one<{ n: number }>("SELECT COUNT(*)::integer AS n FROM message_outbox WHERE kind='intent-match' AND status='skipped'"))?.n, 1);
  await deleteIntent(guests[0].id, (await intentsForUser(guests[0].id))[0].id);
  assert.equal((await intentMatchesForUser(guests[0].id)).length, 0);
});
