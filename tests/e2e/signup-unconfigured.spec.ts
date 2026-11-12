import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { englishStorageState } from "./fixtures";

test("signup is enabled without email credentials and unverified accounts stay restricted", async ({
  playwright,
}) => {
  test.skip(
    !process.env.EVENTLY_E2E_EMAIL_DISABLED,
    "Run with EVENTLY_E2E_EMAIL_DISABLED=1",
  );
  const origin = "http://127.0.0.1:3100";
  const client = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
    storageState: englishStorageState,
  });
  const markup = await (await client.get("/register")).text();
  expect(markup).toContain("You can create your account now.");
  const button = markup.match(/<button\b[^>]*>Create my account/);
  expect(button).not.toBeNull();
  expect(button![0]).not.toContain("disabled");
  const input = {
    name: "Signup Regression",
    email: randomUUID() + "@example.test",
    password: "Local-fixture-password-123!",
  };
  const response = await client.post("/api/auth/register", { data: input });
  expect(response.status()).toBe(201);
  const result = await response.json();
  expect(result.user.emailVerified).toBe(false);
  expect(result.verificationSent).toBe(false);
  expect(result.verificationDelivery).toBe("unavailable");
  expect((await (await client.get("/api/session")).json()).user.id).toBe(
    result.user.id,
  );
  expect(await (await client.get("/verify-email")).text()).toContain(
    "Your account is created and saved.",
  );
  expect(
    (
      await client.post("/api/checkout", {
        data: { eventId: "sample-1", quantity: 1, requestKey: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await client.post("/api/auth/register", { data: input })).status(),
  ).toBe(409);
  expect((await client.post("/api/auth/logout")).status()).toBe(200);
  expect((await client.post("/api/auth/login", { data: input })).status()).toBe(
    200,
  );
  expect((await client.post("/api/auth/resend-verification")).status()).toBe(
    503,
  );
  await client.dispose();
});
