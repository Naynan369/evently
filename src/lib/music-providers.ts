import { createHash, randomBytes, sign } from "node:crypto";
import { one, run, transaction, takeRateLimit } from "./db.ts";
import { AppError, tokenHash } from "./security.ts";
import { applicationOrigin } from "./mail.ts";
import {
  connection,
  saveConnection,
  disconnectMusic,
  disconnectIfCurrent,
  encryptMusic,
  decryptMusic,
  musicEncryptionConfigured,
  saveMusicProfile,
  type Credentials,
} from "./music-store.ts";
import { buildMusicProfile } from "./music-matching.ts";
import type {
  MusicProvider,
  MusicPlaylist,
  MusicTrack,
} from "./music-types.ts";

function spotifyConnectionTestEnabled() {
  if (process.env.SPOTIFY_CONNECTION_TEST !== "true") return false;
  try {
    return ["127.0.0.1", "[::1]"].includes(
      new URL(applicationOrigin()).hostname,
    );
  } catch {
    return false;
  }
}
export function providerAvailability(provider: MusicProvider) {
  const approved =
    provider !== "spotify" || process.env.SPOTIFY_APPROVED_USE_CASE === "true";
  const configured = Boolean(
    process.env.APP_URL &&
    musicEncryptionConfigured() &&
    (provider === "spotify"
      ? process.env.SPOTIFY_CLIENT_ID
      : process.env.APPLE_MUSIC_TEAM_ID &&
        process.env.APPLE_MUSIC_KEY_ID &&
        process.env.APPLE_MUSIC_PRIVATE_KEY),
  );
  const connectionTest =
    provider === "spotify" && !approved && spotifyConnectionTestEnabled();
  return {
    provider,
    available: configured && (approved || connectionTest),
    recommendationsAvailable: configured && approved,
    status: !configured
      ? ("setup" as const)
      : approved
        ? ("ready" as const)
        : connectionTest
          ? ("connection-test" as const)
          : ("approval" as const),
  };
}
function requireProvider(provider: MusicProvider) {
  if (!providerAvailability(provider).available)
    throw new AppError(
      "This music connection isn’t available yet. You can choose artists and genres yourself.",
      503,
    );
}
export function appleDeveloperToken(browser = false) {
  requireProvider("apple");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const value =
    encode({ alg: "ES256", kid: process.env.APPLE_MUSIC_KEY_ID }) +
    "." +
    encode({
      iss: process.env.APPLE_MUSIC_TEAM_ID,
      iat: now,
      exp: now + 3600,
      ...(browser ? { origin: [applicationOrigin()] } : {}),
    });
  try {
    return (
      value +
      "." +
      sign("sha256", Buffer.from(value), {
        key: process.env.APPLE_MUSIC_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        dsaEncoding: "ieee-p1363",
      }).toString("base64url")
    );
  } catch {
    throw new AppError(
      "Apple Music is being configured. Please try again later.",
      503,
    );
  }
}
export async function startSpotify(userId: string, sessionToken: string) {
  requireProvider("spotify");
  const callback = applicationOrigin() + "/api/music/spotify/callback";
  if (new URL(callback).hostname === "localhost")
    throw new AppError(
      "Spotify requires a registered HTTPS or loopback-IP callback address.",
      503,
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  await run(
    "DELETE FROM oauth_states WHERE expires_at<? OR user_id=?",
    Date.now(),
    userId,
  );
  await run(
    "INSERT INTO oauth_states(state_hash,user_id,session_hash,verifier,expires_at) VALUES(?,?,?,?,?)",
    tokenHash(state),
    userId,
    tokenHash(sessionToken),
    encryptMusic(verifier, userId + ":oauth"),
    Date.now() + 600000,
  );
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: callback,
    state,
    scope: "playlist-read-private playlist-read-collaborative",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  return "https://accounts.spotify.com/authorize?" + params;
}
async function spotifyToken(params: URLSearchParams) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    redirect: "error",
  });
  if (!response.ok)
    throw new AppError(
      "Spotify authorization expired or was declined. Please reconnect.",
      401,
    );
  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (
    typeof data.access_token !== "string" ||
    !Number.isFinite(data.expires_in)
  )
    throw new AppError("Spotify returned an incomplete authorization.", 502);
  return data;
}
export async function consumeSpotifyState(
  userId: string,
  sessionToken: string,
  state: string,
) {
  return transaction(async () => {
    const stored = await one<{
      user_id: string;
      session_hash: string;
      verifier: string;
      expires_at: number;
    }>("SELECT * FROM oauth_states WHERE state_hash=?", tokenHash(state));
    if (
      !stored ||
      stored.user_id !== userId ||
      stored.session_hash !== tokenHash(sessionToken) ||
      stored.expires_at < Date.now()
    )
      throw new AppError(
        "This connection request expired. Please start again.",
        400,
      );
    await run("DELETE FROM oauth_states WHERE state_hash=?", tokenHash(state));
    return decryptMusic(stored.verifier, userId + ":oauth");
  });
}
export async function finishSpotify(
  userId: string,
  sessionToken: string,
  state: string,
  code: string,
) {
  requireProvider("spotify");
  const verifier = await consumeSpotifyState(userId, sessionToken, state);
  const token = await spotifyToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: applicationOrigin() + "/api/music/spotify/callback",
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier: verifier,
    }),
  );
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: "Bearer " + token.access_token },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new AppError(
      "Spotify couldn’t connect this account. Check your app’s access permissions.",
      403,
    );
  const account = (await response.json()) as { id: string };
  if (!account.id)
    throw new AppError("Spotify did not return an account.", 502);
  await assertActiveSession(userId, sessionToken);
  await disconnectMusic(userId, "spotify");
  await saveConnection(userId, "spotify", {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    accountId: account.id,
  });
}
async function credentials(
  userId: string,
  provider: MusicProvider,
): Promise<Credentials & { consentAt: number }> {
  requireProvider(provider);
  const saved = await connection(userId, provider);
  if (!saved) throw new AppError("Connect your music account first.", 409);
  if (provider === "spotify" && saved.expiresAt < Date.now() + 60000) {
    if (!saved.refreshToken)
      throw new AppError("Please reconnect Spotify.", 401);
    let token;
    try {
      token = await spotifyToken(
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: saved.refreshToken,
          client_id: process.env.SPOTIFY_CLIENT_ID!,
        }),
      );
    } catch (error) {
      if (error instanceof AppError && error.status === 401)
        await disconnectIfCurrent(userId, provider, saved.consentAt);
      throw error;
    }
    const updated = {
      ...saved,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || saved.refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    const changed = await run(
      "UPDATE music_connections SET credentials=? WHERE user_id=? AND provider=? AND consent_at=?",
      encryptMusic(JSON.stringify(updated), userId + ":" + provider),
      userId,
      provider,
      saved.consentAt,
    );
    if (!changed.changes)
      throw new AppError("This music account has been disconnected.", 409);
    return updated;
  }
  return saved;
}
async function providerRequest<T>(
  userId: string,
  provider: MusicProvider,
  path: string,
) {
  const saved = await credentials(userId, provider);
  const url =
    provider === "spotify"
      ? "https://api.spotify.com/v1" + path
      : "https://api.music.apple.com/v1" + path;
  const headers: Record<string, string> =
    provider === "spotify"
      ? { Authorization: "Bearer " + saved.accessToken }
      : {
          Authorization: "Bearer " + appleDeveloperToken(),
          "Music-User-Token": saved.accessToken,
        };
  const result = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  if (result.status === 401) {
    await disconnectIfCurrent(userId, provider, saved.consentAt);
    throw new AppError(
      "Your music authorization expired. Please reconnect.",
      401,
    );
  }
  if (result.status === 429)
    throw new AppError(
      "Your music service is busy. Wait a moment before trying again.",
      429,
    );
  if (result.status === 403)
    throw new AppError(
      provider === "spotify"
        ? "Spotify cannot share this playlist. Choose a playlist you own or collaborate on, and check your app’s access."
        : "Apple Music access was declined. Check your subscription and reconnect.",
      403,
    );
  if (!result.ok)
    throw new AppError(
      "The music service couldn’t load this collection. Try again shortly.",
      502,
    );
  return (await result.json()) as T;
}
type SpotifyPlaylist = {
  id: string;
  name: string;
  owner?: { id: string };
  collaborative?: boolean;
  items?: { total: number };
  tracks?: { total: number };
};
type AppleItem = {
  id: string;
  type?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    genreNames?: string[];
    url?: string;
    trackCount?: number;
  };
};
type ApplePage = { data: AppleItem[]; next?: string };
function applePlaylist(item: AppleItem): MusicPlaylist {
  const url = item.attributes?.url;
  return {
    id: item.id,
    name: item.attributes?.name || "Untitled playlist",
    url: url?.startsWith("https://music.apple.com/")
      ? url
      : "https://music.apple.com/",
    count: item.attributes?.trackCount || null,
  };
}
function spotifyPlaylist(item: SpotifyPlaylist): MusicPlaylist {
  return {
    id: item.id,
    name: item.name,
    url: "https://open.spotify.com/playlist/" + encodeURIComponent(item.id),
    count: item.items?.total ?? item.tracks?.total ?? null,
  };
}
export async function listMusicPlaylists(
  userId: string,
  provider: MusicProvider,
  offset = 0,
) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 5000)
    throw new AppError("Invalid playlist page.");
  if (provider === "spotify") {
    const account = await credentials(userId, provider);
    const page = await providerRequest<{
      items: SpotifyPlaylist[];
      next: string | null;
    }>(userId, provider, "/me/playlists?limit=50&offset=" + offset);
    return {
      playlists: page.items
        .filter(
          (p) => p && (p.owner?.id === account.accountId || p.collaborative),
        )
        .map(spotifyPlaylist),
      next: page.next ? offset + 50 : null,
    };
  }
  const page = await providerRequest<ApplePage>(
    userId,
    provider,
    "/me/library/playlists?limit=100&offset=" + offset,
  );
  return {
    playlists: page.data.map(applePlaylist),
    next: page.next ? offset + 100 : null,
  };
}
export async function connectApple(
  userId: string,
  token: string,
  sessionToken: string,
) {
  requireProvider("apple");
  if (token.length < 20 || token.length > 6000)
    throw new AppError("Apple Music authorization was incomplete.", 400);
  const response = await fetch(
    "https://api.music.apple.com/v1/me/library/playlists?limit=1",
    {
      headers: {
        Authorization: "Bearer " + appleDeveloperToken(),
        "Music-User-Token": token,
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new AppError(
      "Apple Music could not authorize your library. Check your subscription and try again.",
      401,
    );
  await assertActiveSession(userId, sessionToken);
  await disconnectMusic(userId, "apple");
  await saveConnection(userId, "apple", { accessToken: token, expiresAt: 0 });
}
export async function syncPlaylists(
  userId: string,
  provider: MusicProvider,
  ids: unknown,
) {
  requireProvider(provider);
  if (!providerAvailability(provider).recommendationsAvailable)
    throw new AppError(
      "Spotify is connected for testing only. Playlist imports and event recommendations are not enabled.",
      403,
    );
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 5 ||
    ids.some(
      (id) => typeof id !== "string" || !/^[a-zA-Z0-9._-]{1,150}$/.test(id),
    )
  )
    throw new AppError("Choose between one and five playlists.");
  await takeRateLimit("music-sync:" + userId, 6, 3600000);
  const initial = await one<{ consent_at: number }>(
    "SELECT consent_at FROM music_connections WHERE user_id=? AND provider=?",
    userId,
    provider,
  );
  if (!initial) throw new AppError("Connect your music account first.", 409);
  const tracks: MusicTrack[] = [],
    playlists: MusicPlaylist[] = [];
  let partial = false;
  for (const id of [...new Set(ids)] as string[]) {
    if (provider === "spotify") {
      const account = await credentials(userId, provider);
      const playlist = await providerRequest<SpotifyPlaylist>(
        userId,
        provider,
        "/playlists/" + encodeURIComponent(id),
      );
      if (playlist.owner?.id !== account.accountId && !playlist.collaborative)
        throw new AppError("Choose a playlist you own or collaborate on.", 403);
      playlists.push(spotifyPlaylist(playlist));
      let offset = 0,
        more = true;
      while (more && tracks.length < 500) {
        type Track = {
          id: string;
          type?: string;
          artists?: { name: string }[];
        };
        const page = await providerRequest<{
          items: { item?: Track; track?: Track }[];
          next: string | null;
        }>(
          userId,
          provider,
          "/playlists/" +
            encodeURIComponent(id) +
            "/items?limit=50&offset=" +
            offset,
        );
        for (const entry of page.items) {
          const item = entry.item || entry.track;
          if (item?.id && item.type !== "episode")
            tracks.push({
              id: item.id,
              artists: (item.artists || []).map((a) => a.name),
              genres: [],
            });
        }
        more = Boolean(page.next);
        offset += 50;
        if (offset >= 1000) {
          partial ||= more;
          break;
        }
      }
      if (more) partial = true;
    } else {
      const playlist = await providerRequest<ApplePage>(
        userId,
        provider,
        "/me/library/playlists/" + encodeURIComponent(id),
      );
      if (!playlist.data[0])
        throw new AppError("This playlist is no longer in your library.", 404);
      playlists.push(applePlaylist(playlist.data[0]));
      let offset = 0,
        more = true;
      while (more && tracks.length < 500) {
        const page = await providerRequest<ApplePage>(
          userId,
          provider,
          "/me/library/playlists/" +
            encodeURIComponent(id) +
            "/tracks?limit=100&offset=" +
            offset,
        );
        for (const item of page.data) {
          if (item.type === "library-songs" || item.type === "songs")
            tracks.push({
              id: item.id,
              artists: item.attributes?.artistName
                ? [item.attributes.artistName]
                : [],
              genres: item.attributes?.genreNames || [],
            });
        }
        more = Boolean(page.next);
        offset += 100;
        if (offset >= 1000) {
          partial ||= more;
          break;
        }
      }
      if (more) partial = true;
    }
  }
  if (!tracks.length)
    throw new AppError(
      "These playlists don’t contain readable songs. Try a different playlist.",
      409,
    );
  const profile = buildMusicProfile(
    provider,
    tracks.slice(0, 500),
    playlists,
    partial || tracks.length > 500,
  );
  await transaction(async () => {
    const active = await one<{ consent_at: number }>(
      "SELECT consent_at FROM music_connections WHERE user_id=? AND provider=?",
      userId,
      provider,
    );
    if (!active || active.consent_at !== initial.consent_at)
      throw new AppError("Your connection changed. Please try again.", 409);
    await saveMusicProfile(userId, profile);
  });
  return profile;
}
async function assertActiveSession(userId: string, sessionToken: string) {
  if (
    !(await one(
      "SELECT token_hash FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?",
      tokenHash(sessionToken),
      userId,
      Date.now(),
    ))
  )
    throw new AppError("Your session expired. Sign in and connect again.", 401);
}
