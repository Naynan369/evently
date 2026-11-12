import type { Event } from "../types.ts";
import {
  normalizedGenre,
  normalizedMusicName,
  type MusicProfile,
  type MusicTrack,
  type MusicSource,
  type MusicPlaylist,
} from "./music-types.ts";
export function buildMusicProfile(
  source: MusicSource,
  tracks: MusicTrack[],
  playlists: MusicPlaylist[],
  partial = false,
): MusicProfile {
  const artists = new Map<string, { name: string; weight: number }>(),
    genres = new Map<string, { name: string; weight: number }>();
  const unique = [...new Map(tracks.map((t) => [t.id, t])).values()];
  const add = (
    map: Map<string, { name: string; weight: number }>,
    raw: string,
  ) => {
    const name = raw.trim();
    if (!name || name.length > 100) return;
    const key = normalizedMusicName(name),
      current = map.get(key);
    map.set(key, {
      name: current?.name || name,
      weight: (current?.weight || 0) + 1,
    });
  };
  for (const track of unique) {
    for (const artist of new Set(track.artists)) add(artists, artist);
    for (const genre of new Set(track.genres.map(normalizedGenre)))
      if (genre !== "Music") add(genres, genre);
  }
  const sorted = (m: Map<string, { name: string; weight: number }>) =>
    [...m.values()]
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
      .slice(0, 100);
  return {
    source,
    artists: sorted(artists),
    genres: sorted(genres),
    playlists,
    trackCount: unique.length,
    updatedAt: Date.now(),
    partial,
  };
}
export function matchMusic(
  event: Event,
  profile: MusicProfile | undefined,
  now = Date.now(),
) {
  if (!profile || now - profile.updatedAt > 30 * 86400000)
    return {
      score: 0,
      reasons: [] as string[],
      strength: null as string | null,
    };
  const artists = profile.artists.filter((a) =>
    (event.artists || []).some(
      (b) => normalizedMusicName(a.name) === normalizedMusicName(b),
    ),
  );
  const genres = profile.genres.filter((a) =>
    (event.genres || []).some(
      (b) =>
        normalizedMusicName(normalizedGenre(a.name)) ===
        normalizedMusicName(normalizedGenre(b)),
    ),
  );
  const total = profile.artists.reduce((n, a) => n + a.weight, 0) || 1;
  const artistScore = artists.length
    ? 40 +
      Math.min(20, (artists.reduce((n, a) => n + a.weight, 0) / total) * 50)
    : 0;
  const genreScore = Math.min(18, genres.length * 6);
  const reasons: string[] = [];
  if (artists.length) reasons.push(artists[0].name + " is on the lineup");
  if (genres.length)
    reasons.push(
      "Matches your " +
        genres
          .slice(0, 2)
          .map((g) => g.name.toLowerCase())
          .join(" & ") +
        " taste",
    );
  return {
    score: artistScore + genreScore,
    reasons,
    strength: artists.length
      ? "Artist match"
      : genres.length
        ? "Genre match"
        : null,
  };
}
