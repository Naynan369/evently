import { randomUUID } from "node:crypto";
import {
  createBusinessProfile,
  run,
  takeRateLimit,
  transaction,
  updateInterests,
  userById,
} from "./db.ts";
import { AppError, hashPassword, textField, tokenHash } from "./security.ts";
import {
  deliverAccountToken,
  deliverVerificationCode,
} from "./account-tokens.ts";
import { emailDeliveryMode } from "./mail.ts";
import type { EmailDeliveryMode } from "./types.ts";

export async function registerAccount(input: Record<string, unknown>) {
  const accountType = input.accountType ?? "attendee";
  if (accountType !== "attendee" && accountType !== "organizer")
    throw new AppError("Choose attendee or organizer to continue.");
  const email = textField(input.email, "Email", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError("Enter a valid email address.");
  const name = textField(input.name, "Name", 2, 80);
  const organizationName =
    accountType === "organizer"
      ? textField(input.organizationName, "Organizer name", 2, 120)
      : null;
  if (
    typeof input.password !== "string" ||
    input.password.length < 10 ||
    input.password.length > 128
  )
    throw new AppError("Use a password between 10 and 128 characters.");
  await takeRateLimit("register:" + tokenHash(email), 5);
  const password = await hashPassword(input.password);
  const id = randomUUID();
  try {
    await transaction(async () => {
      await run(
        "INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)",
        id,
        name,
        email,
        password,
        Date.now(),
      );
      if (organizationName) {
        const user = await userById(id);
        if (!user) throw new Error("Could not create the account.");
        await createBusinessProfile(
          {
            kind: "organizer",
            name: organizationName,
            countryCode: input.countryCode ?? "IT",
          },
          user,
        );
      } else {
        await updateInterests(id, input.interests ?? []);
      }
    });
  } catch (error) {
    if (
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505") ||
      String(error).includes("UNIQUE")
    )
      throw new AppError(
        "An account already exists for this email. Sign in or reset your password below.",
        409,
      );
    throw error;
  }
  // Account creation does not depend on a third-party email service. The account
  // remains unverified until the user uses a valid email code or link.
  let verificationDelivery: EmailDeliveryMode | "failed" = emailDeliveryMode();
  if (verificationDelivery !== "unavailable") {
    try {
      if (verificationDelivery === "gmail") await deliverVerificationCode(id);
      else await deliverAccountToken(id, "verify");
    } catch {
      verificationDelivery = "failed";
    }
  }
  return {
    user: (await userById(id))!,
    saved: [],
    verificationSent: verificationDelivery === "gmail",
    verificationDelivery,
  };
}
