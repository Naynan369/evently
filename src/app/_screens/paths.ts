// Public paths for the flat page files in this directory.
export const staticScreenPaths = [
  "",
  "about",
  "account",
  "admin",
  "business-profiles",
  "categories",
  "create-event",
  "event-preview",
  "events",
  "for-you",
  "forgot-password",
  "help",
  "intent",
  "login",
  "music",
  "music/privacy",
  "organizer",
  "organizer/demand",
  "policies",
  "register",
  "report",
  "reset-password",
  "saved",
  "tickets",
  "venue-preview",
  "venues",
  "verify-email",
] as const;

export type ScreenPath = (typeof staticScreenPaths)[number];

export const dynamicScreenRewrites = [
  { source: "/events/:slug", destination: "/render/events/:slug" },
  { source: "/tickets/:id", destination: "/render/tickets/:id" },
] as const;
