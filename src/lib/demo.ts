import type { Event } from "./types.ts";

export function organizerDemoMode() {
  return process.env.EVENTLY_ORGANIZER_DEMO === "true";
}

export function sampleListingsEnabled() {
  return process.env.SEED_DEMO === "true" &&
    (process.env.NODE_ENV !== "production" ||
      process.env.EVENTLY_TEST_MODE === "true");
}

export function eventIsPrivate(event: Event) {
  return event.visibility === "draft" ||
    (organizerDemoMode() && Boolean(event.ownerId));
}
