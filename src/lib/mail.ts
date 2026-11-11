import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as nodemailer from "nodemailer";
import { AppError } from "./security.ts";
import type { EmailDeliveryMode } from "./types.ts";

type OutgoingMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  url?: string;
  code?: string;
};

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

function gmailConfigured() {
  return Boolean(process.env.MYEMAIL?.trim() && process.env.MYPASS?.trim());
}

export function emailConfigured() {
  return emailDeliveryMode() !== "unavailable";
}

export function emailDeliveryMode(): EmailDeliveryMode {
  try {
    applicationOrigin();
    if (previewMailEnabled()) return "preview";
    if (gmailConfigured()) return "gmail";
    return "unavailable";
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

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

async function sendMessage(message: OutgoingMessage) {
  assertEmailConfigured();
  if (previewMailEnabled()) {
    const dir = resolve(
      /* turbopackIgnore: true */ process.env.EMAIL_PREVIEW_DIR ||
        "data/mail-preview",
    );
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(dir, message.id + ".json"),
      JSON.stringify({ ...message, createdAt: Date.now() }),
      { mode: 0o600 },
    );
    return;
  }

  const gmailUser = process.env.MYEMAIL?.trim();
  const gmailPassword = process.env.MYPASS?.trim();
  if (!gmailUser || !gmailPassword)
    throw new AppError("Email delivery is not configured.", 503);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
  });
  const result = await transporter.sendMail({
    from: gmailUser,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  const accepted = Array.isArray(result.accepted) ? result.accepted : [];
  const recipientAccepted = accepted.some((recipient) => {
    const address =
      typeof recipient === "string" ? recipient : recipient.address;
    return (
      typeof address === "string" &&
      address.trim().toLowerCase() === message.to.trim().toLowerCase()
    );
  });
  if (!recipientAccepted)
    throw new AppError(
      "The mail provider did not accept the email. Please try again shortly.",
      503,
    );
}

export async function sendVerificationCodeEmail(input: {
  id: string;
  to: string;
  name: string;
  code: string;
}) {
  const pageUrl = applicationOrigin() + "/verify-email";
  const subject = "Your Evently verification code";
  const text =
    "Hi " +
    input.name +
    ",\n\nYour Evently verification code is " +
    input.code +
    ".\n\nEnter this code at " +
    pageUrl +
    ". It expires in 15 minutes and can only be used once. If you didn’t request this, you can ignore this email.\n\nEvently";
  const html =
    '<html><body style="margin:0;background:#181b1d;font-family:Arial,sans-serif;color:#f2f3f3"><div style="max-width:520px;margin:40px auto;padding:36px"><p style="color:#9de5ef;font-size:24px;font-weight:bold;letter-spacing:-1px">evently.</p><h1 style="font-size:28px;line-height:1.2">Verify your email</h1><p style="color:#aeb5b8;line-height:1.7">Hi ' +
    escape(input.name) +
    ', enter this code on Evently to finish setting up your account.</p><p style="margin:28px 0;padding:18px;border:1px solid #394346;border-radius:10px;background:#222629;text-align:center;color:#9de5ef;font-size:30px;font-weight:bold;letter-spacing:0.22em">' +
    escape(input.code) +
    '</p><p style="color:#aeb5b8;line-height:1.7">This code expires in 15 minutes and can be used once.</p><p><a href="' +
    escape(pageUrl) +
    '" style="color:#9de5ef">Open Evently verification</a></p><p style="color:#aeb5b8;font-size:12px">If you didn’t request this email, you can ignore it.</p></div></body></html>';

  await sendMessage({
    id: input.id,
    to: input.to,
    subject,
    text,
    html,
    url: pageUrl,
    code: input.code,
  });
}

export async function sendAccountEmail(input: {
  id: string;
  to: string;
  name: string;
  purpose: "verify" | "reset";
  url: string;
}) {
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
    '<html><body style="margin:0;background:#181b1d;font-family:Arial,sans-serif;color:#f2f3f3"><div style="max-width:520px;margin:40px auto;padding:36px"><p style="color:#9de5ef;font-size:24px;font-weight:bold;letter-spacing:-1px">evently.</p><h1 style="font-size:28px;line-height:1.2">' +
    heading +
    '</h1><p style="color:#aeb5b8;line-height:1.7">Hi ' +
    escape(input.name) +
    ", use the button below to " +
    (verify ? "confirm your email address" : "choose a new password") +
    '.</p><p style="margin:28px 0"><a href="' +
    escape(input.url) +
    '" style="display:inline-block;padding:14px 21px;background:#9de5ef;color:#172125;border-radius:8px;font-weight:bold;text-decoration:none">' +
    action +
    ' →</a></p><p style="color:#aeb5b8;font-size:13px;line-height:1.7">This link expires in ' +
    expiry +
    ' and can be used once. If you didn’t request this, ignore this email.</p><p style="font-size:12px;color:#aeb5b8;word-break:break-all">Button not working? ' +
    escape(input.url) +
    "</p></div></body></html>";

  await sendMessage({
    id: input.id,
    to: input.to,
    subject,
    text,
    html,
    url: input.url,
  });
}
