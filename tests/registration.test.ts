import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerAccount } from "../src/lib/registration.ts";
import {
  businessProfilesForOwner,
  createBusinessProfile,
  one,
} from "../src/lib/db.ts";
import { accountHome } from "../src/lib/account-home.ts";
import { loadAttendeeDashboard } from "../src/lib/attendee-dashboard.ts";
import { checkPassword } from "../src/lib/security.ts";
import { prepareTestDatabase } from "./database.ts";

await prepareTestDatabase("registration");
process.env.APP_URL = "http://127.0.0.1:3100";
delete process.env.EMAIL_DELIVERY;
delete process.env.MYEMAIL;
delete process.env.MYPASS;

const details = () => ({
  name: "Test Guest",
  email: randomUUID() + "@example.test",
  password: "A-unique-test-password!",
});

test("registration works without email configuration, saves a hashed password and remains unverified", async () => {
  const input = details();
  const result = await registerAccount({
    ...input,
    email: "  " + input.email.toUpperCase() + "  ",
  });
  assert.equal(result.verificationDelivery, "unavailable");
  assert.equal(result.verificationSent, false);
  assert.equal(result.user.emailVerified, false);
  assert.equal(result.user.email, input.email);
  const row = (await one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=?",
    result.user.id,
  ))!;
  assert.notEqual(row.password_hash, input.password);
  assert.equal(await checkPassword(input.password, row.password_hash), true);
  assert.equal(
    (
      await one<{ n: number }>(
        "SELECT count(*) n FROM account_tokens WHERE user_id=?",
        result.user.id,
      )
    )?.n,
    0,
  );
  await assert.rejects(registerAccount(input), { status: 409 });
});

test("signup continues to reject invalid details with email delivery unavailable", async () => {
  const input = details();
  await assert.rejects(registerAccount({ ...input, password: "short" }), {
    status: 400,
  });
  await assert.rejects(registerAccount({ ...input, email: "not-an-email" }), {
    status: 400,
  });
  await assert.rejects(registerAccount({ ...input, name: " " }), {
    status: 400,
  });
  assert.equal(
    await one("SELECT id FROM users WHERE email=?", input.email),
    undefined,
  );
});

test("attendee signup saves chosen interests without creating an organizer profile", async () => {
  const result = await registerAccount({
    ...details(),
    accountType: "attendee",
    interests: ["music", "community"],
  });
  assert.deepEqual(result.user.interests, ["music", "community"]);
  assert.deepEqual(
    await businessProfilesForOwner(result.user.id, "organizer"),
    [],
  );
  assert.equal(await accountHome(result.user.id), "/account");
  assert.deepEqual(await loadAttendeeDashboard(result.user.id), {
    upcoming: [],
    savedCount: 0,
  });
  await createBusinessProfile(
    { kind: "organizer", name: "Guest Events", countryCode: "IT" },
    result.user,
  );
  assert.equal(await accountHome(result.user.id), "/organizer");
});

test("organizer signup creates a named business profile on the same user account", async () => {
  const result = await registerAccount({
    ...details(),
    accountType: "organizer",
    organizationName: "Messina Nights",
    countryCode: "IT",
  });
  assert.equal(result.user.emailVerified, false);
  const profiles = await businessProfilesForOwner(result.user.id, "organizer");
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, "Messina Nights");
  assert.equal(profiles[0].countryCode, "IT");
  assert.equal(await accountHome(result.user.id), "/organizer");
});

test("invalid organizer details leave no partial account", async () => {
  const input = { ...details(), accountType: "organizer" };
  await assert.rejects(registerAccount({ ...input, organizationName: " " }), {
    status: 400,
  });
  await assert.rejects(
    registerAccount({
      ...input,
      organizationName: "Messina Nights",
      countryCode: "XX",
    }),
    { status: 400 },
  );
  assert.equal(
    await one("SELECT id FROM users WHERE email=?", input.email),
    undefined,
  );
});
