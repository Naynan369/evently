import { randomUUID } from "node:crypto";
import { one, run, transaction, userById } from "./db.ts";
import { AppError, hashPassword, randomToken, tokenHash } from "./security.ts";
import { applicationOrigin, sendAccountEmail } from "./mail.ts";
export type TokenPurpose = "verify" | "reset";
type TokenRow = { user_id: string; expires_at: number };
export async function issueAccountToken(userId: string, purpose: TokenPurpose) {
  const token = randomToken();
  await transaction(async () => {
    await run(
      "DELETE FROM account_tokens WHERE expires_at<? OR (user_id=? AND purpose=?)",
      Date.now(),
      userId,
      purpose,
    );
    await run(
      "INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES(?,?,?,?,?)",
      tokenHash(token),
      userId,
      purpose,
      Date.now() + (purpose === "verify" ? 86400000 : 1800000),
      Date.now(),
    );
  });
  return token;
}
async function checkedToken(token: unknown, purpose: TokenPurpose) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new AppError(
      "This link is invalid or expired. Request a new one.",
      400,
    );
  const row = await one<TokenRow>(
    "SELECT user_id,expires_at FROM account_tokens WHERE token_hash=? AND purpose=?",
    tokenHash(token),
    purpose,
  );
  if (!row || row.expires_at <= Date.now())
    throw new AppError(
      "This link is invalid or expired. Request a new one.",
      400,
    );
  return row;
}
export async function deliverAccountToken(
  userId: string,
  purpose: TokenPurpose,
) {
  const user = await userById(userId);
  if (!user) return;
  const token = await issueAccountToken(userId, purpose);
  try {
    await sendAccountEmail({
      id: randomUUID(),
      to: user.email,
      name: user.name,
      purpose,
      url:
        applicationOrigin() +
        (purpose === "verify" ? "/verify-email" : "/reset-password") +
        "?token=" +
        token,
    });
  } catch (error) {
    await run("DELETE FROM account_tokens WHERE token_hash=?", tokenHash(token));
    throw error;
  }
}
export async function verifyEmail(token: unknown) {
  return transaction(async () => {
    const row = await checkedToken(token, "verify");
    await run(
      "UPDATE users SET email_verified_at=? WHERE id=? AND email_verified_at=0",
      Date.now(),
      row.user_id,
    );
    await run(
      "DELETE FROM account_tokens WHERE user_id=? AND purpose='verify'",
      row.user_id,
    );
    return row.user_id;
  });
}
export async function resetPassword(token: unknown, password: unknown) {
  await checkedToken(token, "reset");
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    throw new AppError("Use a password between 10 and 128 characters.");
  const hash = await hashPassword(password);
  return transaction(async () => {
    const row = await checkedToken(token, "reset");
    await run(
      "UPDATE users SET password_hash=?, email_verified_at=CASE WHEN email_verified_at=0 THEN ? ELSE email_verified_at END WHERE id=?",
      hash,
      Date.now(),
      row.user_id,
    );
    await run("DELETE FROM sessions WHERE user_id=?", row.user_id);
    await run("DELETE FROM account_tokens WHERE user_id=?", row.user_id);
    await run("DELETE FROM oauth_states WHERE user_id=?", row.user_id);
    return row.user_id;
  });
}
