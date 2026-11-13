const organizerRoutes = [
  "/organizer",
  "/create-event",
  "/venues",
  "/business-profiles",
  "/event-preview",
  "/venue-preview",
];

export function isOrganizerRoute(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return organizerRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
