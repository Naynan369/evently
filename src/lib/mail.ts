import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AppError } from "./security.ts";
import type { EmailDeliveryMode } from "./types.ts";

export function applicationOrigin() {
  if (!process.env.APP_URL)
    throw new AppError("The application address needs to be configured.", 503);
  const url = new URL(process.env.APP_URL);
  if (
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new AppError("Invalid application address.", 503);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new AppError("Use HTTPS for this application.", 503);
  return url.origin;
}
export function previewMailEnabled() {
  if (process.env.EMAIL_DELIVERY !== "preview") return false;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(applicationOrigin()).hostname,
  );
  return (
    local &&
    (process.env.NODE_ENV !== "production" ||
      process.env.EVENTLY_TEST_MODE === "true")
  );
}
export function emailConfigured() {
  return emailDeliveryMode() !== "unavailable";
}
export function emailDeliveryMode(): EmailDeliveryMode {
  try {
    applicationOrigin();
    if (previewMailEnabled()) return "preview";
    return process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      !process.env.EMAIL_FROM.includes("your-domain.com")
      ? "resend"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
export function assertEmailConfigured() {
  if (!emailConfigured())
    throw new AppError(
      "Email delivery is being set up. Please try again shortly.",
      503,
    );
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function sendAccountEmail(input: {
  id: string;
  to: string;
  name: string;
  purpose: "verify" | "reset";
  url: string;
}) {
  assertEmailConfigured();
  const verify = input.purpose === "verify";
  const heading = verify
    ? "One last step. Then you’re in."
    : "Let’s get you back to your plans.";
  const subject = verify
    ? "Verify your email · Evently"
    : "Reset your password · Evently";
  const action = verify ? "Verify my email" : "Reset my password";
  const expiry = verify ? "24 hours" : "30 minutes";
  const text =
    "Hi " +
    input.name +
    ",\n\n" +
    heading +
    "\n\n" +
    action +
    ": " +
    input.url +
    "\n\nThis link expires in " +
    expiry +
    " and works once. If you didn’t request this, you can ignore this email.\n\nEvently";
  const html =
    '<html><body style="margin:0;background:#101b19;font-family:Arial,sans-serif;color:#f5f5ec"><div style="max-width:520px;margin:48px auto;padding:40px"><p style="color:#d5ed8b;font-size:26px;font-weight:bold">✳ evently.</p><h1 style="font-size:32px;line-height:1.2">' +
    heading +
    '</h1><p style="color:#c4d0c6;line-height:1.7">Hi ' +
    escape(input.name) +
    ", use the button below to " +
    (verify ? "confirm your email address" : "choose a new password") +
    '.</p><p style="margin:32px 0"><a href="' +
    escape(input.url) +
    '" style="display:inline-block;padding:16px 24px;background:#d5ed8b;color:#17231b;border-radius:8px;font-weight:bold;text-decoration:none">' +
    action +
    ' →</a></p><p style="color:#c4d0c6;font-size:13px;line-height:1.7">This link expires in ' +
    expiry +
    ' and can be used once. If you didn’t request this, ignore this email.</p><p style="font-size:12px;color:#c4d0c6;word-break:break-all">Button not working? ' +
    escape(input.url) +
    "</p></div></body></html>";
  if (previewMailEnabled()) {
    // This runtime outbox is private data, never an application build asset.
    const dir = resolve(
      /* turbopackIgnore: true */ process.env.EMAIL_PREVIEW_DIR ||
        "data/mail-preview",
    );
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(dir, input.id + ".json"),
      JSON.stringify({
        to: input.to,
        subject,
        text,
        html,
        url: input.url,
        createdAt: Date.now(),
      }),
      { mode: 0o600 },
    );
    return;
  }
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": "evently-" + input.id,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject,
      html,
      text,
    }),
  });
  if (!result.ok)
    throw new AppError(
      "We couldn’t send the email just now. Please try again shortly.",
      503,
    );
}
