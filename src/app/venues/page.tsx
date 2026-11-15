import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { businessProfilesForOwner, ensureBusinessProfile, venuesForOwner } from "@/lib/db";
import VenueStudio from "@/components/organizer/VenueStudio";

export const metadata = { title: "Venues" };

export default async function VenuesPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/venues");
  if (!user.emailVerified) redirect("/verify-email");
  if (!user.isOrganizer) redirect("/account");

  await ensureBusinessProfile(user, "venue");
  const [venues, profiles] = await Promise.all([
    venuesForOwner(user.id),
    businessProfilesForOwner(user.id, "venue"),
  ]);

  return (
    <main id="main" className="container page-main venue-page">
      <VenueStudio initialVenues={venues} profiles={profiles} />
    </main>
  );
}
