import Recommendations from "@/components/Recommendations";
import { listEvents, listTickets } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { musicProfiles } from "@/lib/music-store";
export const metadata = { title: "For you" };
export default async function ForYou() {
  const user = await currentUser();
  const booked = user
    ? (await listTickets(user.id))
        .filter((b) => b.status === "confirmed")
        .map((b) => b.eventId)
    : [];
  return (
    <main id="main" className="container page-main for-you-page">
      <Recommendations
        events={await listEvents()}
        booked={booked}
        profiles={user ? await musicProfiles(user.id) : []}
      />
    </main>
  );
}
