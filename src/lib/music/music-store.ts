import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { all, one, run, transaction } from "../db.ts";
import { AppError } from "../security.ts";
import {
  type MusicProvider,
  type MusicProfile,
  type MusicSource,
} from "./music-types.ts";
function encryptionKey() {
  const value = process.env.MUSIC_ENCRYPTION_KEY || "";
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new AppError(
      "Music connections are being set up. You can choose artists and genres below.",
      503,
    );
  return key;
}
export function musicEncryptionConfigured() {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}
export function encryptMusic(value: string, context: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptMusic(value: string, context: string) {
  const parts = value.split(".");
  if (parts.length !== 3)
    throw new AppError("Reconnect your music account.", 401);
  try {
    const [iv, tag, data] = parts.map((s) => Buffer.from(s, "base64url"));
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new AppError("Reconnect your music account.", 401);
  }
}
export type Credentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  accountId?: string;
};
export async function connection(userId: string, provider: MusicProvider) {
  const row = await one<{ credentials: string; consent_at: number }>(
    "SELECT credentials,consent_at FROM music_connections WHERE user_id=? AND provider=?",
    userId,
    provider,
  );
  return row
    ? {
        ...(JSON.parse(
          decryptMusic(row.credentials, userId + ":" + provider),
        ) as Credentials),
        consentAt: row.consent_at,
      }
    : null;
}
export async function saveConnection(
  userId: string,
  provider: MusicProvider,
  value: Credentials,
) {
  await run(
    "INSERT INTO music_connections(user_id,provider,credentials,consent_at) VALUES(?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET credentials=excluded.credentials",
    userId,
    provider,
    encryptMusic(JSON.stringify(value), userId + ":" + provider),
    Date.now(),
  );
}
export async function saveMusicProfile(userId: string, profile: MusicProfile) {
  await run(
    "INSERT INTO music_profiles(user_id,provider,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
    userId,
    profile.source,
    JSON.stringify(profile),
    profile.updatedAt,
  );
}
export async function musicProfiles(userId: string) {
  await run(
    "DELETE FROM music_profiles WHERE updated_at<?",
    Date.now() - 30 * 86400000,
  );
  return (await all<{ data: string }>(
    "SELECT data FROM music_profiles WHERE user_id=? ORDER BY updated_at DESC",
    userId,
  ))
    .map((r) => JSON.parse(r.data) as MusicProfile)
    .filter(
      (profile) =>
        profile.source !== "spotify" ||
        process.env.SPOTIFY_APPROVED_USE_CASE === "true",
    );
}
export async function disconnectMusic(userId: string, provider: MusicSource) {
  return transaction(async () => {
    await run(
      "DELETE FROM music_connections WHERE user_id=? AND provider=?",
      userId,
      provider,
    );
    await run(
      "DELETE FROM music_profiles WHERE user_id=? AND provider=?",
      userId,
      provider,
    );
    if (provider === "spotify")
      await run("DELETE FROM oauth_states WHERE user_id=?", userId);
  });
}
export async function disconnectIfCurrent(
  userId: string,
  provider: MusicProvider,
  consentAt: number,
) {
  return transaction(async () => {
    const active = await one<{ consent_at: number }>(
      "SELECT consent_at FROM music_connections WHERE user_id=? AND provider=?",
      userId,
      provider,
    );
    if (active?.consent_at === consentAt) {
      await run(
        "DELETE FROM music_connections WHERE user_id=? AND provider=?",
        userId,
        provider,
      );
      await run(
        "DELETE FROM music_profiles WHERE user_id=? AND provider=?",
        userId,
        provider,
      );
    }
  });
}
