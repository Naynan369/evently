import { randomUUID } from "node:crypto";
import { one, run, transaction, userById } from "./db.ts";
import { AppError, hashPassword, randomToken, tokenHash } from "./security.ts";
import { applicationOrigin, sendAccountEmail } from "./mail.ts";
export type TokenPurpose = "verify" | "reset";
type TokenRow = { user_id: string; expires_at: number };
export function issueAccountToken(userId: string, purpose: TokenPurpose) {
  const token = randomToken();
  transaction(() => {
    run(
      "DELETE FROM account_tokens WHERE expires_at<? OR (user_id=? AND purpose=?)",
      Date.now(),
      userId,
      purpose,
    );
    run(
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
function checkedToken(token: unknown, purpose: TokenPurpose) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new AppError(
      "This link is invalid or expired. Request a new one.",
      400,
    );
  const row = one<TokenRow>(
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
  const user = userById(userId);
  if (!user) return;
  const token = issueAccountToken(userId, purpose);
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
    run("DELETE FROM account_tokens WHERE token_hash=?", tokenHash(token));
    throw error;
  }
}
export function verifyEmail(token: unknown) {
  return transaction(() => {
    const row = checkedToken(token, "verify");
    run(
      "UPDATE users SET email_verified_at=? WHERE id=? AND email_verified_at=0",
      Date.now(),
      row.user_id,
    );
    run(
      "DELETE FROM account_tokens WHERE user_id=? AND purpose='verify'",
      row.user_id,
    );
    return row.user_id;
  });
}
export async function resetPassword(token: unknown, password: unknown) {
  checkedToken(token, "reset");
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    throw new AppError("Use a password between 10 and 128 characters.");
  const hash = await hashPassword(password);
  return transaction(() => {
    const row = checkedToken(token, "reset");
    run(
      "UPDATE users SET password_hash=?, email_verified_at=CASE WHEN email_verified_at=0 THEN ? ELSE email_verified_at END WHERE id=?",
      hash,
      Date.now(),
      row.user_id,
    );
    run("DELETE FROM sessions WHERE user_id=?", row.user_id);
    run("DELETE FROM account_tokens WHERE user_id=?", row.user_id);
    run("DELETE FROM oauth_states WHERE user_id=?", row.user_id);
    return row.user_id;
  });
}
