import { cookies } from "next/headers";
import { one, run, publicUser } from "./db.ts";
import { AppError, randomToken, tokenHash } from "./security.ts";
export const sessionCookie = "evently_session";
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return publicUser(
    await one<Record<string, unknown>>(
      "SELECT u.*, EXISTS(SELECT 1 FROM business_profiles b WHERE b.owner_id=u.id AND b.kind='organizer') AS is_organizer FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      tokenHash(token),
      Date.now(),
    ),
  );
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("Please sign in to continue.", 401);
  return user;
}
export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.emailVerified)
    throw new AppError("Verify your email address to continue.", 403);
  return user;
}
export async function createSession(userId: string) {
  const jar = await cookies();
  const old = jar.get(sessionCookie)?.value;
  if (old) await run("DELETE FROM sessions WHERE token_hash=?", tokenHash(old));
  await run("DELETE FROM sessions WHERE expires_at<?", Date.now());
  const token = randomToken();
  await run(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    tokenHash(token),
    userId,
    Date.now() + 30 * 86400000,
  );
  jar.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") || false,
    path: "/",
    maxAge: 30 * 86400,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await run("DELETE FROM sessions WHERE token_hash=?", tokenHash(token));
  jar.delete(sessionCookie);
}
