import type { Event } from "./types.ts";

export function refundWindowOpen(event: Pick<Event, "startsAt" | "visibility">, now = Date.now()) {
  return event.visibility === "cancelled" || Date.parse(event.startsAt) - now >= 7 * 86400000;
}
