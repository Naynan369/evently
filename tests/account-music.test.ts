import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync, verify } from "node:crypto";
import { one, run, userById } from "../src/lib/db.ts";
import { checkPassword, tokenHash } from "../src/lib/security.ts";
import {
  issueAccountToken,
  verifyEmail,
  resetPassword,
} from "../src/lib/account-tokens.ts";
import {
  encryptMusic,
  decryptMusic,
  saveConnection,
  connection,
  saveMusicProfile,
  musicProfiles,
  disconnectMusic,
} from "../src/lib/music-store.ts";
import {
  startSpotify,
  finishSpotify,
  consumeSpotifyState,
  listMusicPlaylists,
  syncPlaylists,
  providerAvailability,
  appleDeveloperToken,
  connectApple,
} from "../src/lib/music-providers.ts";
import { buildMusicProfile, matchMusic } from "../src/lib/music-matching.ts";
import { seedEvents } from "../src/lib/catalog.ts";
import { recommend } from "../src/lib/recommendations.ts";
import { previewMailEnabled, emailDeliveryMode } from "../src/lib/mail.ts";
import { prepareTestDatabase } from "./database.ts";

await prepareTestDatabase("account_music");
process.env.APP_URL = "http://127.0.0.1:3100";
process.env.MUSIC_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.SPOTIFY_CLIENT_ID = "fixture-client";
process.env.SPOTIFY_APPROVED_USE_CASE = "true";
process.env.SPOTIFY_CONNECTION_TEST = "false";
test("mail delivery clearly distinguishes live setup, missing settings and local preview", () => {
  const before = {
    gmailUser: process.env.MYEMAIL,
    gmailPassword: process.env.MYPASS,
    delivery: process.env.EMAIL_DELIVERY,
  };
  try {
    delete process.env.EMAIL_DELIVERY;
    delete process.env.MYEMAIL;
    delete process.env.MYPASS;
    assert.equal(emailDeliveryMode(), "unavailable");
    process.env.MYEMAIL = "hello@example.test";
    assert.equal(emailDeliveryMode(), "unavailable");
    process.env.MYPASS = "fixture-app-password";
    assert.equal(emailDeliveryMode(), "gmail");
    process.env.EMAIL_DELIVERY = "preview";
    assert.equal(emailDeliveryMode(), "preview");
  } finally {
    for (const [name, value] of Object.entries({
      MYEMAIL: before.gmailUser,
      MYPASS: before.gmailPassword,
      EMAIL_DELIVERY: before.delivery,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
async function user() {
  const id = randomUUID();
  await run(
    "INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)",
    id,
    "Test Person",
    id + "@example.test",
    "unused",
    Date.now(),
  );
  return id;
}
async function session(id: string) {
  const token = "a".repeat(64);
  await run(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET user_id=EXCLUDED.user_id,expires_at=EXCLUDED.expires_at",
    tokenHash(token),
    id,
    Date.now() + 600000,
  );
  return token;
}
const playlist = {
  id: "playlist1",
  name: "Favorites",
  owner: { id: "listener" },
  items: { total: 2 },
};
async function spotify(id: string, expired = false) {
  await saveConnection(id, "spotify", {
    accessToken: "fixture-access",
    refreshToken: "fixture-refresh",
    expiresAt: Date.now() + (expired ? -1000 : 3600000),
    accountId: "listener",
  });
}
test("email verification links are hashed, single-use, purpose-bound and expire", async () => {
  const id = await user(),
    first = await issueAccountToken(id, "verify");
  assert.equal(
    await one("SELECT * FROM account_tokens WHERE token_hash=?", first),
    undefined,
  );
  const reset = await issueAccountToken(id, "reset");
  await assert.rejects(verifyEmail(reset), /invalid or expired/);
  const current = await issueAccountToken(id, "verify");
  await assert.rejects(verifyEmail(first), /invalid or expired/);
  assert.equal(await verifyEmail(current), id);
  assert.equal((await userById(id))?.emailVerified, true);
  await assert.rejects(verifyEmail(current), /invalid or expired/);
  const expired = await issueAccountToken(id, "verify");
  await run(
    "UPDATE account_tokens SET expires_at=? WHERE token_hash=?",
    Date.now() - 1,
    tokenHash(expired),
  );
  await assert.rejects(verifyEmail(expired), /invalid or expired/);
});
test("password reset verifies mailbox ownership and revokes all sessions and tokens", async () => {
  const id = await user();
  await session(id);
  await issueAccountToken(id, "verify");
  const token = await issueAccountToken(id, "reset");
  await assert.rejects(resetPassword(token, "short"), /10 and 128/);
  await resetPassword(token, "A-new-secure-password!");
  assert.equal((await userById(id))?.emailVerified, true);
  assert.equal(
    await checkPassword(
      "A-new-secure-password!",
      (await one<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id=?",
        id,
      ))!.password_hash,
    ),
    true,
  );
  assert.equal(await one("SELECT * FROM sessions WHERE user_id=?", id), undefined);
  assert.equal(
    await one("SELECT * FROM account_tokens WHERE user_id=?", id),
    undefined,
  );
  await assert.rejects(
    resetPassword(token, "Another-secure-password"),
    /invalid or expired/,
  );
});
test("production email preview cannot be enabled on a public origin", () => {
  process.env.EMAIL_DELIVERY = "preview";
  process.env.EVENTLY_TEST_MODE = "true";
  process.env.APP_URL = "https://events.example.test";
  assert.equal(previewMailEnabled(), false);
  process.env.APP_URL = "http://127.0.0.1:3100";
  assert.equal(previewMailEnabled(), true);
  delete process.env.EMAIL_DELIVERY;
  delete process.env.EVENTLY_TEST_MODE;
});
test("music credentials are encrypted and bound to their owner and provider", () => {
  const encrypted = encryptMusic("private-token", "owner:spotify");
  assert.equal(encrypted.includes("private-token"), false);
  assert.equal(decryptMusic(encrypted, "owner:spotify"), "private-token");
  assert.throws(() => decryptMusic(encrypted, "other:spotify"), /Reconnect/);
  assert.throws(() => decryptMusic(encrypted, "owner:apple"), /Reconnect/);
  const parts = encrypted.split(".");
  parts[2] = Buffer.from("tampered").toString("base64url");
  assert.throws(
    () => decryptMusic(parts.join("."), "owner:spotify"),
    /Reconnect/,
  );
});
test("Spotify stays disabled without approval or a local connection test; PKCE state is session-bound and one-time", async () => {
  delete process.env.SPOTIFY_APPROVED_USE_CASE;
  assert.equal(providerAvailability("spotify").available, false);
  process.env.SPOTIFY_APPROVED_USE_CASE = "true";
  const id = await user();
  const token = await session(id);
  const url = new URL(await startSpotify(id, token));
  const state = url.searchParams.get("state")!;
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "http://127.0.0.1:3100/api/music/spotify/callback",
  );
  await assert.rejects(consumeSpotifyState(id, "wrong", state), /expired/);
  await assert.rejects(consumeSpotifyState(await user(), token, state), /expired/);
  assert.ok((await consumeSpotifyState(id, token, state)).length >= 43);
  await assert.rejects(consumeSpotifyState(id, token, state), /expired/);
});
test("local Spotify connection test allows authorization and playlist listing but blocks imports and retained recommendation profiles", async (t) => {
  const before = {
    APP_URL: process.env.APP_URL,
    SPOTIFY_APPROVED_USE_CASE: process.env.SPOTIFY_APPROVED_USE_CASE,
    SPOTIFY_CONNECTION_TEST: process.env.SPOTIFY_CONNECTION_TEST,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  };
  try {
    process.env.SPOTIFY_APPROVED_USE_CASE = "false";
    process.env.SPOTIFY_CONNECTION_TEST = "true";
    assert.equal(providerAvailability("spotify").available, true);
    assert.equal(providerAvailability("spotify").status, "connection-test");
    assert.equal(
      providerAvailability("spotify").recommendationsAvailable,
      false,
    );
    const id = await user();
    const sessionToken = await session(id);
    const url = new URL(await startSpotify(id, sessionToken));
    const calls: string[] = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request) => {
        const requestUrl = String(input);
        calls.push(requestUrl);
        if (requestUrl === "https://accounts.spotify.com/api/token")
          return Response.json({
            access_token: "test-access",
            refresh_token: "test-refresh",
            expires_in: 3600,
          });
        if (requestUrl === "https://api.spotify.com/v1/me")
          return Response.json({ id: "listener" });
        if (requestUrl.includes("/me/playlists?"))
          return Response.json({ items: [playlist], next: null });
        throw new Error("Unexpected provider request during connection test");
      },
    );
    await finishSpotify(
      id,
      sessionToken,
      url.searchParams.get("state")!,
      "fixture-code",
    );
    assert.equal((await connection(id, "spotify"))?.accountId, "listener");
    assert.equal(
      (await listMusicPlaylists(id, "spotify")).playlists[0].name,
      "Favorites",
    );
    const callsBeforeImport = calls.length;
    await assert.rejects(
      syncPlaylists(id, "spotify", ["playlist1"]),
      /testing only/,
    );
    assert.equal(calls.length, callsBeforeImport);
    assert.deepEqual(await musicProfiles(id), []);
    await saveMusicProfile(
      id,
      buildMusicProfile(
        "spotify",
        [{ id: "old-song", artists: ["Artist"], genres: [] }],
        [],
      ),
    );
    await saveMusicProfile(
      id,
      buildMusicProfile(
        "manual",
        [{ id: "manual", artists: ["My choice"], genres: [] }],
        [],
      ),
    );
    assert.deepEqual(
      (await musicProfiles(id)).map((p) => p.source),
      ["manual"],
    );
    process.env.APP_URL = "https://events.example.test";
    assert.equal(providerAvailability("spotify").available, false);
    await assert.rejects(startSpotify(id, sessionToken), /isn’t available/);
    process.env.APP_URL = "http://localhost:3100";
    assert.equal(providerAvailability("spotify").available, false);
    process.env.APP_URL = before.APP_URL;
    delete process.env.SPOTIFY_CLIENT_ID;
    assert.equal(providerAvailability("spotify").available, false);
    await disconnectMusic(id, "spotify");
    assert.equal(await connection(id, "spotify"), null);
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
test("music matching uses exact artist names, deduplicates songs, ignores stale tastes and keeps booking exclusions", async () => {
  const profile = buildMusicProfile(
    "apple",
    [
      { id: "1", artists: ["Björk"], genres: ["Electronic"] },
      { id: "1", artists: ["Björk"], genres: ["Electronic"] },
      { id: "2", artists: ["Björk"], genres: ["Music"] },
    ],
    [],
  );
  assert.equal(profile.trackCount, 2);
  assert.equal(profile.artists[0].weight, 2);
  const events = seedEvents(),
    target = { ...events[0], artists: ["BJORK"] };
  assert.equal(matchMusic(target, profile).strength, "Artist match");
  assert.equal(
    matchMusic({ ...target, artists: ["Björk tribute"] }, profile).strength,
    "Genre match",
  );
  assert.equal(
    matchMusic(target, { ...profile, updatedAt: Date.now() - 31 * 86400000 })
      .score,
    0,
  );
  assert.equal(
    recommend([target], [], [], [target.id], Date.now(), profile).length,
    0,
  );
  const id = await user();
  await saveMusicProfile(id, profile);
  await spotify(id);
  await disconnectMusic(id, "apple");
  assert.equal((await musicProfiles(id)).length, 0);
  assert.ok(await connection(id, "spotify"));
});
test("Spotify reads 2026 playlist items, filters inaccessible lists and refreshes expired authorization", async (t) => {
  const id = await user();
  await spotify(id, true);
  const urls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/api/token")) {
        assert.match(String(init?.body), /grant_type=refresh_token/);
        return Response.json({ access_token: "renewed", expires_in: 3600 });
      }
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer renewed",
      );
      if (url.includes("/me/playlists"))
        return Response.json({
          items: [
            playlist,
            { ...playlist, id: "foreign", owner: { id: "another" } },
          ],
          next: null,
        });
      if (url.includes("/items?"))
        return Response.json({
          items: [
            {
              item: {
                id: "track1",
                type: "track",
                artists: [{ name: "Test Artist" }],
              },
            },
            { item: { id: "podcast", type: "episode" } },
          ],
          next: null,
        });
      return Response.json(playlist);
    },
  );
  const lists = await listMusicPlaylists(id, "spotify");
  assert.deepEqual(
    lists.playlists.map((p) => p.id),
    ["playlist1"],
  );
  const profile = await syncPlaylists(id, "spotify", ["playlist1"]);
  assert.equal(profile.trackCount, 1);
  assert.equal(profile.artists[0].name, "Test Artist");
  assert.ok(urls.some((u) => u.includes("/playlists/playlist1/items?")));
  assert.equal((await connection(id, "spotify"))?.accessToken, "renewed");
});
test("disconnecting during refresh or playlist sync cannot recreate retained data", async (t) => {
  const id = await user();
  await spotify(id, true);
  const mocked = t.mock.method(globalThis, "fetch", async () => {
    await disconnectMusic(id, "spotify");
    return Response.json({ access_token: "obsolete", expires_in: 3600 });
  });
  await assert.rejects(listMusicPlaylists(id, "spotify"), /disconnected/);
  assert.equal(await connection(id, "spotify"), null);
  mocked.mock.restore();
  await spotify(id);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    if (String(input).includes("/items?")) {
      await disconnectMusic(id, "spotify");
      return Response.json({
        items: [{ item: { id: "song", artists: [{ name: "Singer" }] } }],
        next: null,
      });
    }
    return Response.json(playlist);
  });
  await assert.rejects(
    syncPlaylists(id, "spotify", ["playlist1"]),
    /connection changed/,
  );
  assert.deepEqual(await musicProfiles(id), []);
});
test("Apple signs a short-lived origin-restricted token and imports only selected library songs", async (t) => {
  const keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.APPLE_MUSIC_TEAM_ID = "TEAMFIXTURE";
  process.env.APPLE_MUSIC_KEY_ID = "KEYFIXTURE";
  process.env.APPLE_MUSIC_PRIVATE_KEY = keys.privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  const jwt = appleDeveloperToken(true),
    [header, payload, signature] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.exp - claims.iat, 3600);
  assert.deepEqual(claims.origin, ["http://127.0.0.1:3100"]);
  assert.equal(
    verify(
      "sha256",
      Buffer.from(header + "." + payload),
      { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
  const id = await user();
  const token = await session(id);
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      assert.equal(
        new Headers(init?.headers).get("Music-User-Token"),
        "apple-user-token-fixture",
      );
      if (url.includes("/tracks?"))
        return Response.json({
          data: [
            {
              id: "song",
              type: "library-songs",
              attributes: { artistName: "Test Singer", genreNames: ["Jazz"] },
            },
          ],
        });
      return Response.json({
        data: [{ id: "p.1", attributes: { name: "My jazz", trackCount: 1 } }],
      });
    },
  );
  await connectApple(id, "apple-user-token-fixture", token);
  const profile = await syncPlaylists(id, "apple", ["p.1"]);
  assert.equal(profile.artists[0].name, "Test Singer");
  assert.equal(profile.genres[0].name, "Jazz");
  assert.equal(profile.trackCount, 1);
  assert.ok(calls.some((u) => u.includes("/me/library/playlists/p.1/tracks?")));
});
