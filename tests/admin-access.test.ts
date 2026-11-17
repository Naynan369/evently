import test from "node:test";
import assert from "node:assert/strict";
import { isOperator } from "../src/lib/operations.ts";
import { normalizeCrmUpdate } from "../src/lib/admin-crm.ts";
import { registerAccount } from "../src/lib/registration.ts";
import type { User } from "../src/lib/types.ts";

const account: User = {
  id: "role-check",
  name: "Administrator",
  email: "admin@example.test",
  role: "USER",
  interests: [],
  stripeAccount: null,
  emailVerified: true,
};

test("only a verified stored admin role grants access", () => {
  assert.equal(isOperator(account), false);
  assert.equal(isOperator({ ...account, role: "ADMIN" }), true);
  assert.equal(isOperator({ ...account, role: "ADMIN", emailVerified: false }), false);
  assert.equal(isOperator({ ...account, email: "someone-else@example.test" }), false);
});

test("public registration cannot request an admin role", async () => {
  await assert.rejects(registerAccount({ accountType: "admin" }), { status: 400 });
});

test("CRM follow-ups accept real dates and clear completed reminders", () => {
  assert.deepEqual(
    normalizeCrmUpdate({ status: "open", followUpOn: "2028-02-29" }),
    { status: "open", followUpOn: "2028-02-29" },
  );
  assert.deepEqual(
    normalizeCrmUpdate({ status: "resolved", followUpOn: "2028-02-29" }),
    { status: "resolved", followUpOn: null },
  );
  assert.throws(
    () => normalizeCrmUpdate({ status: "open", followUpOn: "2027-02-29" }),
    { status: 400 },
  );
  assert.throws(
    () => normalizeCrmUpdate({ status: "invalid", followUpOn: null }),
    { status: 400 },
  );
});
