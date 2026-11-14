import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { Pool } from "pg";
import { resolve } from "node:path";
import { readdir, readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3100";
async function mailLink(email: string, purpose = "verify-email") {
  const dir = resolve("test-results/mail");
  const messages = await Promise.all(
    (await readdir(dir)).map(
      async (name) =>
        JSON.parse(await readFile(resolve(dir, name), "utf8")) as {
          to: string;
          url: string;
          createdAt: number;
        },
    ),
  );
  const message = messages
    .filter((m) => m.to === email.toLowerCase() && m.url.includes("/" + purpose + "?"))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!message) throw new Error("Expected test email was not delivered");
  return message.url;
}
test("discovery, mobile navigation, themes and accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Events worth",
  );
  await page.getByLabel("Search events", { exact: true }).fill("Afterglow");
  await page.getByLabel("City", { exact: true }).fill("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".event-grid .home-feature-card")).toHaveCount(1);
  await expect(page.locator(".event-grid .home-feature-card")).toContainText("Afterglow");
  await page.goto("/events?price=free");
  const freeCards = page.locator(".event-grid .home-feature-card");
  await expect(freeCards.first()).toBeVisible();
  for (const price of await freeCards.locator(".home-feature-card__price strong").allTextContents())
    expect(price).toBe("Free");
  await page.goto("/events?q=does-not-exist");
  await expect(
    page.getByText("Let’s try a different direction."),
  ).toBeVisible();
  await page.goto("/");
  const bg = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page
    .getByRole("button", { name: "Toggle light and dark appearance" })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(bg);
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dark.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Toggle light and dark appearance" })
    .click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator(".messina-home-area")).toHaveCount(6);
  await page.locator(".messina-home-area").nth(4).hover();
  await expect(page.locator(".messina-home-stage__caption strong")).toHaveText(
    "Torre Faro",
  );
  const light = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(light.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#mobile-nav")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-nav")).toHaveCount(0);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("account, interests, saves, sample booking, QR and cancellation", async ({
  page,
}) => {
  const email = "guest-" + randomUUID() + "@example.test";
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Test Guest");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Correct-password-123!");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/verify-email/);
  await page.goto(await mailLink(email));
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "You’re verified.",
  );
  await page.goto("/for-you");
  await page.getByRole("button", { name: "Music", exact: true }).click();
  await page.getByRole("button", { name: "Save my taste" }).click();
  await expect(page.getByRole("status")).toContainText("interests are saved");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Music", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/events/afterglow-rooftop-sessions");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await page.goto("/saved");
  await expect(page.locator(".event-card")).toHaveCount(1);
  await page.goto("/events/afterglow-rooftop-sessions");
  await page.getByLabel("Number of tickets").selectOption("2");
  await page.getByRole("button", { name: "Try a sample booking" }).click();
  await expect(page).toHaveURL(/tickets\//);
  await expect(page.getByText("This is a sample ticket.")).toBeVisible();
  await expect(page.locator(".ticket-paper")).toContainText("2 guests");
  await expect(page.locator(".ticket-qr img")).toBeVisible();
  const ticketUrl = page.url();
  const id = ticketUrl.split("/tickets/")[1];
  const qr = await page.request.get("/api/tickets/" + id + "/qr");
  expect(qr.status()).toBe(200);
  expect(await qr.text()).toContain("<svg");
  const calendar = await page.request.get("/api/tickets/" + id + "/calendar");
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await page.getByRole("button", { name: "Yes, cancel booking" }).click();
  await expect(page.locator(".ticket-main .status").first()).toContainText(
    "Cancelled",
  );
  expect((await page.request.get("/api/tickets/" + id + "/qr")).status()).toBe(
    409,
  );
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(ticketUrl);
  await expect(page).toHaveURL(/login/);
});
test("organizer flow, inventory, ownership, check-in and webhook verification", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const guest = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const outsider = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  for (const [client, name] of [
    [owner, "Owner"],
    [guest, "Guest"],
    [outsider, "Outsider"],
  ] as const) {
    const email = name + "-" + randomUUID() + "@example.test";
    const result = await client.post("/api/auth/register", {
      data: {
        name,
        email,
        password: "Safe-password-123!",
      },
    });
    expect(result.status()).toBe(201);
    const verification = await mailLink(email);
    expect(
      (
        await client.post("/api/auth/verify-email", {
          data: { token: new URL(verification).searchParams.get("token") },
        })
      ).status(),
    ).toBe(200);
  }
  const paymentReadiness = await owner.get("/api/stripe/status?diagnostics=1");
  expect(paymentReadiness.status()).toBe(200);
  expect(await paymentReadiness.json()).toMatchObject({
    flagEnabled: false,
    testKey: true,
    appUrlSet: true,
    organizerDemoOff: true,
    enabled: false,
  });
  const uploadedCover = await owner.post("/api/event-images", {
    multipart: {
      image: {
        name: "community-cover.jpg",
        mimeType: "image/jpeg",
        buffer: await readFile(resolve("public/images/community-photo.jpg")),
      },
    },
  });
  expect(uploadedCover.status()).toBe(201);
  const coverImage = (await uploadedCover.json()).url as string;
  expect((await owner.get(coverImage)).status()).toBe(200);
  const eventData = {
    title: "A real test gathering",
    description:
      "A fully described gathering to test capacity, tickets and organizer access.",
    category: "community",
    city: "London",
    venue: "Test Room",
    address: "1 Test Road, London",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    timezone: "Europe/London",
    price: 0,
    currency: "gbp",
    capacity: 2,
    image: "community",
    coverImage,
  };
  const created = await owner.post("/api/events", { data: eventData });
  expect(created.status()).toBe(201);
  const event = (await created.json()).event;
  const edited = await owner.put("/api/events/" + event.id, {
    data: { ...eventData, coverImage: "" },
  });
  expect(edited.status()).toBe(200);
  expect((await edited.json()).event.coverImage).toBe(coverImage);
  expect(
    (await guest.put("/api/events/" + event.id, { data: eventData })).status(),
  ).toBe(404);
  const nonce = randomUUID();
  const reservation = await guest.post("/api/checkout", {
    data: { eventId: event.id, quantity: 2, requestKey: nonce, price: 999 },
  });
  expect(reservation.status()).toBe(200);
  const id = (await reservation.json()).bookingId;
  expect(
    (
      await (
        await guest.post("/api/checkout", {
          data: { eventId: event.id, quantity: 2, requestKey: nonce },
        })
      ).json()
    ).bookingId,
  ).toBe(id);
  expect(
    (
      await outsider.post("/api/checkout", {
        data: { eventId: event.id, quantity: 1, requestKey: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  expect((await owner.get("/api/tickets/" + id)).status()).toBe(404);
  expect(
    (
      await owner.put("/api/events/" + event.id, {
        data: { ...eventData, capacity: 1 },
      })
    ).status(),
  ).toBe(409);
  const ticket = (await (await guest.get("/api/tickets/" + id)).json()).booking;
  expect(ticket.total).toBe(0);
  const qr = await guest.get("/api/tickets/" + id + "/qr");
  expect(qr.status()).toBe(200);
  expect(await qr.text()).toContain("<svg");
  const calendar = await guest.get("/api/tickets/" + id + "/calendar");
  expect(calendar.status()).toBe(200);
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
  expect(
    (
      await outsider.post("/api/organizer/check-in", {
        data: { code: ticket.code },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await owner.post("/api/organizer/check-in", {
        data: { code: ticket.code },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await owner.post("/api/organizer/check-in", {
        data: { code: ticket.code },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await guest.post("/api/tickets/" + id + "/cancel", { data: {} })).status(),
  ).toBe(409);
  expect(
    (
      await guest.put("/api/interests", {
        headers: { Origin: "https://evil.test" },
        data: { interests: ["music"] },
      })
    ).status(),
  ).toBe(403);
  expect((await outsider.get("/api/organizer")).status()).toBe(200);
  expect(
    (await (await outsider.get("/api/organizer")).json()).bookings,
  ).toHaveLength(0);
  expect(
    (
      await owner.post("/api/events", { data: { ...eventData, price: 1500 } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await guest.post("/api/stripe/webhook", {
        data: {},
        headers: { "stripe-signature": "forged" },
      })
    ).status(),
  ).toBe(400);
  // Insert a pending fixture only in the isolated test database; no Stripe network call or charge is made.
  const database = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: "-c search_path=evently_test_e2e,public",
  });
  const paidId = randomUUID();
  const checkoutSessionId = "cs_local_" + randomUUID();
  const user = (await (await guest.get("/api/session")).json()).user;
  await database.query(
    "INSERT INTO bookings(id,user_id,event_id,quantity,total,currency,status,mode,code,session_id,expires_at,created_at,request_key,stripe_account) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    [
      paidId,
      user.id,
      event.id,
      1,
      1500,
      "gbp",
      "pending",
      "stripe",
      "EV-" + randomUUID(),
      checkoutSessionId,
      9999999999,
      Date.now(),
      randomUUID(),
      "acct_fixture",
    ],
  );
  const stripe = new Stripe("sk_test_local_fixture_only");
  const object = {
    id: checkoutSessionId,
    client_reference_id: paidId,
    amount_total: 1500,
    currency: "gbp",
    payment_status: "paid",
    metadata: { booking_id: paidId },
  };
  const payload = JSON.stringify({
    id: "evt_" + randomUUID(),
    object: "event",
    type: "checkout.session.completed",
    account: "acct_fixture",
    data: { object },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_local_fixture_only",
  });
  expect(
    (
      await guest.post("/api/stripe/webhook", {
        data: payload,
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": signature,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await guest.post("/api/stripe/webhook", {
        data: payload,
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": signature,
        },
      })
    ).status(),
  ).toBe(200);
  const paidBooking = await database.query(
    "SELECT status FROM bookings WHERE id=$1",
    [paidId],
  );
  expect(paidBooking.rows[0]?.status).toBe("confirmed");
  expect(
    (
      await outsider.post("/api/tickets/" + paidId + "/refund-request", {
        data: {},
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await guest.post("/api/tickets/" + paidId + "/refund-request", {
        data: {},
      })
    ).status(),
  ).toBe(200);
  const organizerBookings = (await (await owner.get("/api/organizer")).json())
    .bookings;
  expect(
    organizerBookings.find((b: { id: string }) => b.id === paidId)
      .refundRequested,
  ).toBeGreaterThan(0);
  await database.end();
  await owner.dispose();
  await guest.dispose();
  await outsider.dispose();
});
