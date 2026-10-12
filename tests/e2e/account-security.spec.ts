import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const origin = "http://127.0.0.1:3100";
async function token(email: string, purpose: string) {
  const dir = resolve("test-results/mail");
  const mails = await Promise.all(
    (await readdir(dir)).map(async (file) =>
      JSON.parse(await readFile(resolve(dir, file), "utf8")),
    ),
  );
  const mail = mails
    .filter((m) => m.to === email && new URL(m.url).pathname === "/" + purpose)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  expect(mail).toBeTruthy();
  return new URL(mail.url).searchParams.get("token");
}
test("account security API: verification, music preferences and password recovery", async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const second = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const anonymous = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const email = "security-" + randomUUID() + "@example.test",
    password = "Original-password-123!";
  expect(await (await client.get("/register")).text()).toContain(
    "Preview mode: no email will be sent to your inbox.",
  );
  const registered = await client.post("/api/auth/register", {
    data: { name: "Security Test", email, password },
  });
  expect(registered.status()).toBe(201);
  const registration = await registered.json();
  expect(registration.user.emailVerified).toBe(false);
  expect(registration.verificationSent).toBe(false);
  expect(registration.verificationDelivery).toBe("preview");
  expect(await (await client.get("/verify-email")).text()).toContain(
    "No email is sent to your inbox.",
  );
  expect(
    (
      await client.post("/api/checkout", {
        data: { eventId: "sample-1", quantity: 1, requestKey: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  expect((await client.post("/api/events", { data: {} })).status()).toBe(403);
  expect(
    (
      await client.put("/api/music/manual", {
        data: { artists: "Test Artist", genres: ["Electronic"] },
      })
    ).status(),
  ).toBe(403);
  let verification = await token(email, "verify-email");
  expect(
    (await client.get("/verify-email?token=" + verification)).status(),
  ).toBe(200);
  expect(
    (await (await client.get("/api/session")).json()).user.emailVerified,
  ).toBe(false);
  expect(
    (await client.post("/api/auth/resend-verification", { data: {} })).status(),
  ).toBe(200);
  expect(
    (await client.post("/api/auth/resend-verification", { data: {} })).status(),
  ).toBe(429);
  expect(
    (
      await client.post("/api/auth/verify-email", {
        data: { token: verification },
      })
    ).status(),
  ).toBe(400);
  verification = await token(email, "verify-email");
  expect(
    (
      await client.post("/api/auth/verify-email", {
        data: { token: verification },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await client.post("/api/auth/verify-email", {
        data: { token: verification },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await (await client.get("/api/session")).json()).user.emailVerified,
  ).toBe(true);
  expect(
    (
      await client.put("/api/music/manual", {
        data: { artists: "Test Artist", genres: ["Electronic"] },
      })
    ).status(),
  ).toBe(200);
  const status = await (await client.get("/api/music/status")).json();
  expect(status.profiles[0].artists[0].name).toBe("Test Artist");
  const spotify = status.providers.find(
    (p: { provider: string }) => p.provider === "spotify",
  );
  expect(spotify.available).toBe(true);
  expect(spotify.recommendationsAvailable).toBe(false);
  expect(spotify.status).toBe("connection-test");
  expect((await anonymous.get("/api/music/status")).status()).toBe(401);
  expect(
    (
      await client.post("/api/music/spotify/connect", {
        data: { consent: false },
      })
    ).status(),
  ).toBe(400);
  const started = await client.post("/api/music/spotify/connect", {
    data: { consent: true },
  });
  expect(started.status()).toBe(200);
  const authorization = new URL((await started.json()).url);
  expect(authorization.origin).toBe("https://accounts.spotify.com");
  expect(authorization.searchParams.get("redirect_uri")).toBe(
    origin + "/api/music/spotify/callback",
  );
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  expect(
    (
      await client.post("/api/music/spotify/sync", {
        data: { playlistIds: ["fixture"] },
      })
    ).status(),
  ).toBe(403);
  const cancelled = await client.get(
    "/api/music/spotify/callback?error=access_denied&state=" +
      encodeURIComponent(authorization.searchParams.get("state")!),
    { maxRedirects: 0 },
  );
  expect(cancelled.status()).toBe(303);
  expect(cancelled.headers().location).toBe(
    origin + "/music?connection=cancelled",
  );
  expect(
    (
      await client.post("/api/music/disconnect", {
        data: { provider: "manual" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await client.get("/api/music/status")).json()).profiles,
  ).toEqual([]);
  expect(
    (
      await second.post("/api/auth/login", { data: { email, password } })
    ).status(),
  ).toBe(200);
  const known = await anonymous.post("/api/auth/forgot-password", {
    data: { email },
  });
  const unknown = await anonymous.post("/api/auth/forgot-password", {
    data: { email: "unknown-" + randomUUID() + "@example.test" },
  });
  expect(known.status()).toBe(200);
  expect((await known.json()).delivery).toBe("preview");
  expect(unknown.status()).toBe(200);
  expect(await known.json()).toEqual(await unknown.json());
  const reset = await token(email, "reset-password");
  expect(
    (
      await anonymous.post("/api/auth/reset-password", {
        data: { token: reset, password: "short" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await anonymous.post("/api/auth/reset-password", {
        data: { token: reset, password: "Replacement-password-123!" },
      })
    ).status(),
  ).toBe(200);
  expect((await (await client.get("/api/session")).json()).user).toBe(null);
  expect((await (await second.get("/api/session")).json()).user).toBe(null);
  expect(
    (
      await anonymous.post("/api/auth/reset-password", {
        data: { token: reset, password: "Replacement-again-123!" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await client.post("/api/auth/login", { data: { email, password } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await client.post("/api/auth/login", {
        data: { email, password: "Replacement-password-123!" },
      })
    ).status(),
  ).toBe(200);
  await client.dispose();
  await second.dispose();
  await anonymous.dispose();
});
