import type { MessinaArea } from "./messina";

export type Category =
  "music" | "arts" | "food" | "technology" | "wellness" | "community";
export type VenueType =
  | "club"
  | "concert-hall"
  | "bar-restaurant"
  | "outdoor"
  | "gallery"
  | "community"
  | "other";
export type BusinessProfileKind = "organizer" | "venue";
export type BusinessProfile = {
  id: string;
  ownerId: string;
  kind: BusinessProfileKind;
  name: string;
  countryCode: string;
  stripeAccount: string | null;
  createdAt: number;
  updatedAt: number;
};
export type Venue = {
  id: string;
  ownerId: string;
  hostProfileId?: string;
  name: string;
  type: VenueType;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: "IT";
  timezone: string;
  capacity: number;
  spaces: string[];
  facilities: string[];
  accessibility: string[];
  houseRules: string;
  setupNotes: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};
export type Event = {
  id: string;
  slug: string;
  ownerId: string | null;
  title: string;
  description: string;
  category: Category;
  city: string;
  area?: MessinaArea;
  venue: string;
  address: string;
  accessNotes?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  price: number;
  vipPrice?: number;
  currency: string;
  capacity: number;
  vipCapacity?: number;
  available: number;
  standardAvailable?: number;
  vipAvailable?: number;
  image: string;
  coverImage?: string;
  host: string;
  venueId?: string;
  organizerProfileId?: string;
  visibility?: "draft" | "review" | "rejected" | "published" | "cancelled";
  sample: boolean;
  artists?: string[];
  genres?: string[];
};
export type TicketType = "standard" | "vip";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  interests: Category[];
  stripeAccount: string | null;
  emailVerified: boolean;
  isOrganizer?: boolean;
};
export type Booking = {
  id: string;
  userId: string;
  eventId: string;
  ticketType: TicketType;
  quantity: number;
  total: number;
  currency: string;
  status: "pending" | "confirmed" | "expired" | "cancelled" | "refunded";
  mode: "sample" | "free" | "stripe";
  code: string;
  sessionId: string | null;
  checkoutUrl: string | null;
  expiresAt: number;
  createdAt: number;
  checkedIn: number;
  refundRequested: number;
  previewVatPercent: number;
  previewVatAmount: number;
  previewTicketRefs: string[];
  requestKey: string;
  stripeAccount: string | null;
  demoGuestName?: string | null;
};
export type Ticket = Booking & { event: Event };
export type EmailDeliveryMode = "gmail" | "preview" | "unavailable";
