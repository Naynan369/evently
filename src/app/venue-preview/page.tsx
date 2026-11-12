import { notFound } from "next/navigation";
import VenueStudio from "@/components/organizer/VenueStudio";
import type { BusinessProfile, Venue } from "@/lib/types";

export const metadata = { title: "Venue workspace preview" };

export default function VenueWorkspacePreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  const previewVenue: Venue = {
    id: "preview-venue",
    ownerId: "preview-owner",
    name: "Sala del Porto",
    type: "concert-hall",
    description:
      "An intimate waterfront room for live music, private gatherings and late-night sessions.",
    address: "Via della Marina 18",
    city: "Messina",
    postalCode: "98122",
    countryCode: "IT",
    timezone: "Europe/Rome",
    capacity: 280,
    spaces: ["Main hall", "Harbour terrace", "Green room"],
    facilities: ["Stage", "PA system", "Bar"],
    accessibility: ["Step-free entrance", "Accessible toilet"],
    houseRules: "",
    setupNotes: "",
    active: true,
    createdAt: 0,
    updatedAt: 0,
  };
  const previewProfile: BusinessProfile = {
    id: "preview-venue-profile",
    ownerId: "preview-owner",
    kind: "venue",
    name: "Porto Rooms S.r.l.",
    countryCode: "IT",
    stripeAccount: null,
    createdAt: 0,
    updatedAt: 0,
  };
  previewVenue.hostProfileId = previewProfile.id;

  return (
    <main id="main" className="container page-main venue-page">
      <p className="venue-feedback" role="status">
        Design preview · example venue details
      </p>
      <VenueStudio initialVenues={[previewVenue]} profiles={[previewProfile]} />
    </main>
  );
}
