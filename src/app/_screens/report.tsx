import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listTickets } from "@/lib/db";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "Report a problem", robots: { index: false, follow: false } };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ event?: string; booking?: string }> }) {
  const { event, booking } = await searchParams;
  const user = await currentUser();
  if (!user) {
    const query = new URLSearchParams();
    if (event) query.set("event", event);
    if (booking) query.set("booking", booking);
    redirect("/login?next=" + encodeURIComponent("/report" + (query.size ? `?${query}` : "")));
  }
  const bookings = (await listTickets(user.id)).map((item) => ({ id: item.id, title: item.event.title }));
  return <ReportForm eventId={event || ""} bookingId={booking || ""} bookings={bookings} />;
}
