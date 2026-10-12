import type { Event, User } from "./types.ts";
import type { MusicProfile } from "./music-types.ts";
import { matchMusic } from "./music-matching.ts";
export function recommend(
  events: Event[],
  interests: User["interests"],
  savedIds: string[] = [],
  excludedIds: string[] = [],
  now = Date.now(),
  music?: MusicProfile,
) {
  const savedCategories = new Set(
    events.filter((e) => savedIds.includes(e.id)).map((e) => e.category),
  );
  return events
    .filter(
      (e) =>
        Date.parse(e.startsAt) > now &&
        e.available > 0 &&
        !excludedIds.includes(e.id),
    )
    .map((event) => {
      let score = 0;
      let reason = "Something new to discover";
      if (interests.includes(event.category)) {
        score += 10;
        reason = "Matches your interests";
      }
      if (savedCategories.has(event.category)) {
        score += 4;
        if (!interests.includes(event.category))
          reason = "Inspired by your saved events";
      }
      if (event.price === 0) score += 1;
      if (savedIds.includes(event.id)) {
        score += 2;
        reason = "On your saved list";
      }
      const match = matchMusic(event, music, now);
      if (match.score) {
        score += match.score;
        reason = match.reasons.join(" · ");
      }
      return { event, score, reason, musicMatch: match.strength };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt),
    );
}
