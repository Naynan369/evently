import type { Event } from "./types.ts";

export function organizerDemoMode() {
  return process.env.EVENTLY_ORGANIZER_DEMO === "true";
}

export function eventIsPrivate(event: Event) {
  return event.visibility === "draft" ||
    (organizerDemoMode() && Boolean(event.ownerId));
}
