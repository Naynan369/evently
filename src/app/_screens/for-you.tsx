import Recommendations from "@/components/Recommendations";
import { listEvents, listTickets } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { musicProfiles } from "@/lib/music/music-store";
import { getLanguage } from "@/lib/i18n-server";
import { localizePublicEvents } from "@/lib/google-translation-server";
export const metadata = { title: "For you" };
export default async function ForYou() {
  const language = await getLanguage();
  const user = await currentUser();
  const booked = user
    ? (await listTickets(user.id))
        .filter((b) => b.status === "confirmed")
        .map((b) => b.eventId)
    : [];
  return (
    <main id="main" className="container page-main for-you-page">
      <Recommendations
        events={await localizePublicEvents(await listEvents(), language)}
        booked={booked}
        profiles={user ? await musicProfiles(user.id) : []}
      />
    </main>
  );
}
