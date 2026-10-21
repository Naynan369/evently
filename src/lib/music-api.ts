import { cookies } from "next/headers";
import { sessionCookie } from "./auth.ts";
import { all, parseTags, takeRateLimit } from "./db.ts";
import { AppError, textField } from "./security.ts";
import { applicationOrigin } from "./mail.ts";
import {
  providerAvailability,
  startSpotify,
  finishSpotify,
  consumeSpotifyState,
  appleDeveloperToken,
  connectApple,
  listMusicPlaylists,
  syncPlaylists,
} from "./music-providers.ts";
import {
  musicProfiles,
  saveMusicProfile,
  disconnectMusic,
} from "./music-store.ts";
import {
  musicGenres,
  type MusicProvider,
  type MusicSource,
  type MusicStatus,
} from "./music-types.ts";
import type { User } from "./types.ts";
export async function musicStatus(userId?: string): Promise<MusicStatus> {
  const connections = userId
    ? await all<{ provider: string }>(
        "SELECT provider FROM music_connections WHERE user_id=?",
        userId,
      )
    : [];
  return {
    providers: (["spotify", "apple"] as MusicProvider[]).map((provider) => ({
      ...providerAvailability(provider),
      connected: connections.some((c) => c.provider === provider),
    })),
    profiles: userId ? await musicProfiles(userId) : [],
  };
}
const json = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "private, no-store" } });
function provider(value: string): MusicProvider {
  if (value !== "spotify" && value !== "apple")
    throw new AppError("Unknown music service.", 404);
  return value;
}
export async function musicApi(
  request: Request,
  path: string[],
  user: User,
  input: Record<string, unknown> = {},
) {
  const route = path.join("/"),
    method = request.method;
  if (route === "music/status" && method === "GET")
    return json(await musicStatus(user.id));
  if (route === "music/spotify/callback" && method === "GET") {
    const query = new URL(request.url).searchParams;
    try {
      const state = textField(query.get("state"), "Connection state", 20, 200),
        session = (await cookies()).get(sessionCookie)?.value || "";
      if (query.has("error")) {
        await consumeSpotifyState(user.id, session, state);
        return Response.redirect(
          applicationOrigin() + "/music?connection=cancelled",
          303,
        );
      }
      await finishSpotify(
        user.id,
        session,
        state,
        textField(query.get("code"), "Authorization", 10, 2000),
      );
      return Response.redirect(
        applicationOrigin() + "/music?connection=spotify",
        303,
      );
    } catch {
      return Response.redirect(
        applicationOrigin() + "/music?connection=failed",
        303,
      );
    }
  }
  if (route === "music/spotify/connect" && method === "POST") {
    if (input.consent !== true)
      throw new AppError("Confirm that you want to connect your playlists.");
    await takeRateLimit("music-connect:" + user.id, 12, 3600000);
    const session = (await cookies()).get(sessionCookie)?.value || "";
    return json({ url: await startSpotify(user.id, session) });
  }
  if (route === "music/apple/config" && method === "POST") {
    if (input.consent !== true)
      throw new AppError("Confirm that you want to connect your playlists.");
    await takeRateLimit("apple-config:" + user.id, 12, 3600000);
    return json({ developerToken: appleDeveloperToken(true) });
  }
  if (route === "music/apple/connect" && method === "POST") {
    if (input.consent !== true)
      throw new AppError("Confirm that you want to connect your playlists.");
    await takeRateLimit("music-connect:" + user.id, 12, 3600000);
    await connectApple(
      user.id,
      textField(input.token, "Apple Music authorization", 20, 6000),
      (await cookies()).get(sessionCookie)?.value || "",
    );
    return json(await musicStatus(user.id));
  }
  if (path.length === 3 && path[2] === "playlists" && method === "GET") {
    await takeRateLimit("music-list:" + user.id, 60, 3600000);
    return json(
      await listMusicPlaylists(
        user.id,
        provider(path[1]),
        Number(new URL(request.url).searchParams.get("offset") || 0),
      ),
    );
  }
  if (path.length === 3 && path[2] === "sync" && method === "POST") {
    await syncPlaylists(user.id, provider(path[1]), input.playlistIds);
    return json(await musicStatus(user.id));
  }
  if (route === "music/manual" && method === "PUT") {
    const artists = parseTags(input.artists, "Artists", 30),
      genres = parseTags(input.genres, "Genres", 18);
    if (genres.some((g) => !musicGenres.includes(g)))
      throw new AppError("Choose genres from the list.");
    if (!artists.length && !genres.length)
      throw new AppError("Choose at least one artist or genre.");
    await saveMusicProfile(user.id, {
      source: "manual",
      artists: artists.map((name) => ({ name, weight: 1 })),
      genres: genres.map((name) => ({ name, weight: 1 })),
      playlists: [],
      trackCount: 0,
      updatedAt: Date.now(),
      partial: false,
    });
    return json(await musicStatus(user.id));
  }
  if (route === "music/disconnect" && method === "POST") {
    const source = textField(input.provider, "Music source") as MusicSource;
    if (!["spotify", "apple", "manual"].includes(source))
      throw new AppError("Unknown music source.");
    await disconnectMusic(user.id, source);
    return json(await musicStatus(user.id));
  }
  throw new AppError("Not found.", 404);
}
