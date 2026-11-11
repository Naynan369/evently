import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerAccount } from "../src/lib/registration.ts";
import { one } from "../src/lib/db.ts";
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
    (await one<{ n: number }>(
      "SELECT count(*) n FROM account_tokens WHERE user_id=?",
      result.user.id,
    ))?.n,
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
