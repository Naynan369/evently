import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { bookingById, getEvent } from "@/lib/db";
import { reconcileBooking } from "@/lib/payments";
import { eventDate, eventTime, money } from "@/lib/format";
import TicketActions from "@/components/TicketActions";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";
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
  const language = await getLanguage();
  const t = (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
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
          <FiArrowLeft /> {t("ticket.back")}
        </Link>
        {booking.demoGuestName ? (
          <div className="notice notice-warm">
            <strong>{language === "it" ? "Biglietto di esempio" : "Sample ticket"}</strong>{" "}
            {language === "it"
              ? "Questo biglietto serve solo per provare la gestione degli ospiti e non è valido per l'ingresso."
              : "This ticket is for reviewing guest management and is not valid for admission."}
          </div>
        ) : booking.mode === "sample" && (
          <div className="notice notice-warm">
            <strong>{t("ticket.sampleTitle")}</strong> {t("ticket.sampleBody")}
          </div>
        )}
        {paymentError && (
          <div className="notice">
            {t("ticket.paymentCheckError")}
          </div>
        )}
        {booking.status === "pending" && (
          <div className="notice">
            <strong>{t("ticket.awaiting")}</strong> {t("ticket.awaitingBody")}
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
                {t(("tickets." + booking.status) as TranslationKey)}
                {booking.checkedIn ? " · " + t("ticket.checkedIn") : ""}
              </span>
              <h1>{event.title}</h1>
              <p>
                <strong>{eventDate(event.startsAt, event.timezone, false, language)}</strong>
                <br />
                {eventTime(event.startsAt, event.timezone, false, language)} · {event.timezone}
              </p>
              <p>
                {event.venue}
                <br />
                {event.address}
              </p>
              <p>
                <strong>{booking.demoGuestName || user.name}</strong> · {booking.quantity}{" "}
                {booking.quantity === 1 ? t("ticket.guest") : t("ticket.guests")}
              </p>
            </div>
            <div className="ticket-qr">
              {booking.status === "confirmed" ? (
                <>
                  <Image
                    src={"/api/tickets/" + booking.id + "/qr"}
                    alt={t("ticket.qrAlt")}
                    width={150}
                    height={150}
                    unoptimized
                  />
                  <code className="ticket-code">{booking.code}</code>
                  <span>{t("ticket.groupCode", { count: booking.quantity })}</span>
                </>
              ) : (
                <>
                  <span className={"status status-" + booking.status}>
                    {t(("tickets." + booking.status) as TranslationKey)}
                  </span>
                  <p>
                    {t("ticket.confirmedOnly")}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="ticket-footer">
            <span>
              evently. · {booking.ticketType === "vip" ? "VIP" : t("booking.standard")} {t("ticket.admission")}
            </span>
            <strong>
              {booking.mode === "sample"
                ? t("ticket.samplePayment")
                : money(booking.total, booking.currency, language)}
            </strong>
          </div>
        </article>
        <TicketActions booking={booking} />
        {booking.mode === "stripe" && booking.status === "confirmed" && (
          <div className="notice">
            {t("ticket.refundHelp", { organizer: event.host })}
          </div>
        )}
      </div>
    </main>
  );
}
