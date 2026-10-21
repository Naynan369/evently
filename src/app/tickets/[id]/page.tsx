import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { bookingById, getEvent } from "@/lib/db";
import { reconcileBooking } from "@/lib/payments";
import { eventDate, eventTime, money } from "@/lib/format";
import TicketActions from "@/components/TicketActions";
export const metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
};
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/tickets/" + id));
  let booking = await bookingById(id);
  if (!booking || booking.userId !== user.id) notFound();
  let paymentError = false;
  try {
    booking = await reconcileBooking(booking);
  } catch {
    paymentError = true;
  }
  const event = (await getEvent(booking.eventId))!;
  return (
    <main id="main" className="container section page-main">
      <div className="ticket-detail">
        <Link href="/tickets" className="breadcrumb">
          <FiArrowLeft /> All your tickets
        </Link>
        {booking.mode === "sample" && (
          <div className="notice notice-warm">
            <strong>This is a sample ticket.</strong> It demonstrates the
            booking experience and does not grant admission to a real event. You
            have not been charged.
          </div>
        )}
        {paymentError && (
          <div className="notice">
            We couldn’t check the payment service just now. Your booking is
            saved; try checking its status again shortly.
          </div>
        )}
        {booking.status === "pending" && (
          <div className="notice">
            <strong>Awaiting payment confirmation.</strong> Your ticket will
            become available after Stripe confirms a successful payment. Leaving
            checkout does not automatically cancel the reservation.
          </div>
        )}
        <article className="ticket-paper">
          <div className="ticket-cover">
            <Image
              src={"/images/" + event.image + ".jpg"}
              alt=""
              fill
              sizes="810px"
              priority
            />
          </div>
          <div className="ticket-main">
            <div>
              <span className={"status status-" + booking.status}>
                {booking.status}
                {booking.checkedIn ? " · checked in" : ""}
              </span>
              <h1>{event.title}</h1>
              <p>
                <strong>{eventDate(event.startsAt, event.timezone)}</strong>
                <br />
                {eventTime(event.startsAt, event.timezone)} · {event.timezone}
              </p>
              <p>
                {event.venue}
                <br />
                {event.address}
              </p>
              <p>
                <strong>{user.name}</strong> · {booking.quantity}{" "}
                {booking.quantity === 1 ? "guest" : "guests"}
              </p>
            </div>
            <div className="ticket-qr">
              {booking.status === "confirmed" ? (
                <>
                  <Image
                    src={"/api/tickets/" + booking.id + "/qr"}
                    alt="Ticket QR code for organizer check-in"
                    width={150}
                    height={150}
                    unoptimized
                  />
                  <code className="ticket-code">{booking.code}</code>
                  <span>One code admits your group of {booking.quantity}.</span>
                </>
              ) : (
                <>
                  <span className={"status status-" + booking.status}>
                    {booking.status}
                  </span>
                  <p>
                    Your entry code is only available for a confirmed booking.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="ticket-footer">
            <span>evently. · General admission</span>
            <strong>
              {booking.mode === "sample"
                ? "Sample · no payment"
                : money(booking.total, booking.currency)}
            </strong>
          </div>
        </article>
        <TicketActions booking={booking} />
        {booking.mode === "stripe" && booking.status === "confirmed" && (
          <div className="notice">
            Need a refund? Your organizer, <strong>{event.host}</strong>,
            manages refunds through their organizer studio.
          </div>
        )}
      </div>
    </main>
  );
}
