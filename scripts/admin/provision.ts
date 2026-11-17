import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { issueAccountToken } from "../../src/lib/account-tokens.ts";
import { closeDatabase, initializeDatabase, one, run, transaction } from "../../src/lib/db.ts";
import { applicationOrigin, assertEmailConfigured, emailDeliveryMode, sendOperationalEmail } from "../../src/lib/mail.ts";
import { AppError, hashPassword, randomToken, textField } from "../../src/lib/security.ts";

function option(name: string) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log('Usage: npm run admin:provision -- --email admin@example.com --name "Evently Admin"');
    return;
  }
  nextEnv.loadEnvConfig(process.cwd());
  const email = textField(option("--email"), "Email", 5, 254).toLowerCase();
  const name = textField(option("--name"), "Name", 2, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError("Enter a valid email address.");
  assertEmailConfigured();
  const origin = applicationOrigin();
  await initializeDatabase();

  const id = randomUUID();
  const passwordHash = await hashPassword(randomToken());
  await transaction(async () => {
    await run("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const admins = await one<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM users WHERE role='ADMIN'",
    );
    if (admins?.count)
      throw new AppError("An admin already exists. Grant further access from the private Accounts view.", 409);
    const existing = await one<{ id: string }>(
      "SELECT id FROM users WHERE email=?", email,
    );
    if (existing)
      throw new AppError("This email already has an Evently account. Use a separate email for a dedicated admin.", 409);
    await run(
      "INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)",
      id, name, email, passwordHash, "ADMIN", Date.now(),
    );
  });

  const messageId = randomUUID();
  try {
    const token = await issueAccountToken(id, "reset");
    await sendOperationalEmail({
      id: messageId,
      to: email,
      subject: "Set up your Evently administrator account",
      text: `Hi ${name},\n\nYour private Evently administrator account is ready. Open this link to set your password and verify your email:\n\n${origin}/reset-password?token=${token}\n\nThe link expires in 30 minutes and works once. If you did not request this account, ignore this email.`,
    });
  } catch (error) {
    await run("DELETE FROM users WHERE id=? AND email_verified_at=0", id);
    throw error;
  }
  if (emailDeliveryMode() === "preview") {
    console.log("Admin setup preview saved to " + resolve(process.env.EMAIL_PREVIEW_DIR || "data/mail-preview", messageId + ".json"));
  } else {
    console.log("Admin setup email sent to " + email + ".");
  }
  console.log("The account becomes active after the owner opens the link and sets a password.");
}

main()
  .catch((error) => {
    console.error("Admin provisioning failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
