export type MusicProvider = "spotify" | "apple";
export type MusicSource = MusicProvider | "manual";
export type MusicPlaylist = {
  id: string;
  name: string;
  url: string;
  count: number | null;
};
export type MusicProfile = {
  source: MusicSource;
  artists: { name: string; weight: number }[];
  genres: { name: string; weight: number }[];
  playlists: MusicPlaylist[];
  trackCount: number;
  updatedAt: number;
  partial: boolean;
};
export type MusicStatus = {
  providers: {
    provider: MusicProvider;
    available: boolean;
    recommendationsAvailable: boolean;
    connected: boolean;
    status: "ready" | "setup" | "approval" | "connection-test";
  }[];
  profiles: MusicProfile[];
};
export type MusicTrack = { id: string; artists: string[]; genres: string[] };
export const musicGenres = [
  "Electronic",
  "House",
  "Techno",
  "Drum & bass",
  "Pop",
  "Rock",
  "Indie",
  "Hip-hop",
  "R&B",
  "Jazz",
  "Soul",
  "Classical",
  "Folk",
  "Country",
  "Metal",
  "Reggae",
  "Latin",
  "Ambient",
];
export const musicProviderName = (provider: MusicSource) =>
  provider === "spotify"
    ? "Spotify"
    : provider === "apple"
      ? "Apple Music"
      : "Your selections";
export function normalizedMusicName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function normalizedGenre(value: string) {
  const name = normalizedMusicName(value);
  const aliases: Record<string, string> = {
    alternative: "Indie",
    "alternative rock": "Indie",
    "alternative and indie": "Indie",
    "hip hop": "Hip-hop",
    "hip hop rap": "Hip-hop",
    rap: "Hip-hop",
    "r and b soul": "R&B",
    "r and b": "R&B",
    "rhythm and blues": "R&B",
    dance: "Electronic",
    electronica: "Electronic",
    edm: "Electronic",
    "drum and bass": "Drum & bass",
    dnb: "Drum & bass",
  };
  return (
    aliases[name] ||
    musicGenres.find((g) => normalizedMusicName(g) === name) ||
    value.trim()
  );
}
