export const adminViews = [
  "overview",
  "events",
  "organizers",
  "users",
  "crm",
  "tickets",
  "payments",
  "moderation",
  "settings",
] as const;

export type AdminView = (typeof adminViews)[number];

export function adminViewFromParam(value: string | null): AdminView {
  return adminViews.find((view) => view === value) ?? "overview";
}
