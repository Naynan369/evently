import { accountHome } from "./account-home.ts";
import { listTickets, savedIds } from "./db.ts";

export async function loadAttendeeDashboard(userId: string) {
  const [tickets, saved, home] = await Promise.all([
    listTickets(userId),
    savedIds(userId),
    accountHome(userId),
  ]);
  const now = Date.now();
  const upcoming = tickets
    .filter(
      (ticket) =>
        Date.parse(ticket.event.startsAt) > now &&
        (ticket.status === "confirmed" ||
          (ticket.status === "pending" && ticket.expiresAt * 1000 > now)),
    )
    .sort(
      (a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt),
    );
  return { upcoming, savedCount: saved.length, home };
}
