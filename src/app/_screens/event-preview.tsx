import { notFound } from "next/navigation";
import EventForm from "@/components/organizer/EventForm";
import type { BusinessProfile, Venue } from "@/lib/types";

export const metadata = { title: "Event setup preview" };

export default function EventSetupPreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  const previewVenue: Venue = {
    id: "preview-venue",
    ownerId: "preview-owner",
    name: "Sala del Porto",
    type: "concert-hall",
    description: "An intimate waterfront live music room.",
    address: "Via della Marina 18",
    city: "Messina",
    postalCode: "98122",
    countryCode: "IT",
    timezone: "Europe/Rome",
    capacity: 280,
    spaces: ["Main hall", "Harbour terrace"],
    facilities: ["Stage", "PA system", "Bar"],
    accessibility: ["Step-free entrance"],
    houseRules: "",
    setupNotes: "",
    active: true,
    createdAt: 0,
    updatedAt: 0,
  };
  const organizerProfile: BusinessProfile = {
    id: "preview-organizer-profile",
    ownerId: "preview-owner",
    kind: "organizer",
    name: "Messina Live",
    countryCode: "IT",
    stripeAccount: null,
    createdAt: 0,
    updatedAt: 0,
  };
  const venueProfile: BusinessProfile = {
    id: "preview-venue-profile",
    ownerId: "preview-owner",
    kind: "venue",
    name: "Porto Rooms S.r.l.",
    countryCode: "IT",
    stripeAccount: null,
    createdAt: 0,
    updatedAt: 0,
  };
  previewVenue.hostProfileId = venueProfile.id;

  return (
    <main id="main" className="container page-main create-event-workspace">
      <div className="page-heading">
        <span className="eyebrow">DESIGN PREVIEW · MESSINA</span>
        <h1>Bring people together.</h1>
        <p>One sign-in can switch between separate event organizer and venue host profiles.</p>
      </div>
      <EventForm
        venues={[previewVenue]}
        organizerProfiles={[organizerProfile]}
        venueProfiles={[venueProfile]}
      />
    </main>
  );
}
