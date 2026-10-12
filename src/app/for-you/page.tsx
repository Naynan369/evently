import Recommendations from "@/components/Recommendations";
import { listEvents, listTickets } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { musicProfiles } from "@/lib/music-store";
export const metadata = { title: "For you" };
export default async function ForYou() {
  const user = await currentUser();
  const booked = user
    ? listTickets(user.id)
        .filter((b) => b.status === "confirmed")
        .map((b) => b.eventId)
    : [];
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">FOLLOW YOUR OWN CURIOSITY</span>
        <h1>A little more your thing.</h1>
        <p>
          Good recommendations start with you. Tell us what sparks your interest
          and find a reason to get out there.
        </p>
      </div>
      <Recommendations
        events={listEvents()}
        booked={booked}
        profiles={user ? musicProfiles(user.id) : []}
      />
    </main>
  );
}
