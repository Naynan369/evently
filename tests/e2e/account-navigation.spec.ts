import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mailLink } from "./fixtures";

const origin = "http://127.0.0.1:3100";
const password = "Account-menu-test-123!";

test("account navigation follows the signed-in account type", async ({
  browser,
  playwright,
}) => {
  for (const accountType of ["attendee", "organizer"] as const) {
    const email = `${accountType}-${randomUUID()}@example.test`;
    const client = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
    const registration = await client.post("/api/auth/register", {
      data: {
        name: "Menu Test",
        email,
        password,
        accountType,
        ...(accountType === "organizer"
          ? { organizationName: "Menu Test Events", countryCode: "IT" }
          : {}),
      },
    });
    expect(registration.status()).toBe(201);
    expect((await registration.json()).user.isOrganizer).toBe(
      accountType === "organizer",
    );
    const verification = await mailLink(email);
    expect(
      (
        await client.post("/api/auth/verify-email", {
          data: { token: new URL(verification).searchParams.get("token") },
        })
      ).status(),
    ).toBe(200);
    expect((await client.post("/api/auth/logout")).status()).toBe(200);
    const login = await client.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status()).toBe(200);
    expect((await login.json()).user.isOrganizer).toBe(
      accountType === "organizer",
    );

    const context = await browser.newContext({
      storageState: await client.storageState(),
    });
    const page = await context.newPage();
    if (accountType === "organizer") {
      await page.goto("/account");
      await expect(page).toHaveURL(/\/organizer$/);
    }
    await page.goto("/");
    await page.getByRole("button", { name: "My account" }).click();
    const menu = page.locator("#account-nav");
    if (accountType === "organizer") {
      await expect(menu.getByRole("link", { name: /Organizer dashboard/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Create an event/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Business profiles/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Tickets & bookings/ })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: /Saved events/ })).toHaveCount(0);
    } else {
      await expect(menu.getByRole("link", { name: /Tickets & bookings/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Saved events/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Organizer dashboard/ })).toHaveCount(0);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    const mobile = page.locator("#mobile-nav");
    await expect(mobile.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(
      mobile.getByRole("link", {
        name: accountType === "organizer" ? /Organizer dashboard/ : /Tickets & bookings/,
      }),
    ).toBeVisible();
    await context.close();
    await client.dispose();
  }
});
