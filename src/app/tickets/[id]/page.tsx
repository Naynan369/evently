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
import { isPlatformTestBooking } from "@/lib/platform-checkout-test";
import { refundWindowOpen } from "@/lib/refund-policy";
import { deliverMessagesBestEffort } from "@/lib/operations";
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
    if (booking.status === "confirmed") await deliverMessagesBestEffort(1);
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
        {isPlatformTestBooking(booking) && (
          <div className="notice notice-warm">
            <strong>{language === "it" ? "Pagamento di prova" : "Test payment"}</strong>{" "}
            {language === "it"
              ? "Il pagamento è simulato da Stripe. Questo biglietto non è valido per l'ingresso e non genera un accredito all'organizzatore."
              : "Stripe simulated this payment. This ticket is not valid for entry and does not pay the organizer."}
          </div>
        )}
        {paymentError && (
          <div className="notice">
            {t("ticket.paymentCheckError")}
          </div>
        )}
        {event.visibility === "cancelled" && (
          <div className="notice notice-warm" role="status">
            <strong>{language === "it" ? "Evento annullato" : "Event cancelled"}</strong>{" "}
            {language === "it" ? "Questo biglietto non è valido per l'ingresso. I biglietti pagati danno diritto a un rimborso completo." : "This ticket is no longer valid for entry. Paid tickets are due a full refund."}
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
              src={event.coverImage || "/images/" + event.image + ".jpg"}
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
              {event.visibility === "cancelled" ? (
                <span className="status status-pending">{language === "it" ? "ANNULLATO" : "CANCELLED"}</span>
              ) : isPlatformTestBooking(booking) ? (
                <>
                  <span className="status status-pending">
                    {language === "it" ? "SOLO PROVA" : "TEST ONLY"}
                  </span>
                  <p>{language === "it" ? "Non valido per l'ingresso." : "Not valid for entry."}</p>
                </>
              ) : booking.status === "confirmed" ? (
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
              evently. · {booking.ticketType === "vip" ? "VIP" : t("booking.standard")}{" "}
              {isPlatformTestBooking(booking)
                ? language === "it" ? "prova checkout" : "checkout test"
                : t("ticket.admission")}
            </span>
            <strong>
              {booking.mode === "sample"
                ? t("ticket.samplePayment")
                : money(booking.total, booking.currency, language)}
            </strong>
          </div>
          {booking.status === "confirmed" && booking.previewTicketRefs.length > 0 && (
            <div className="ticket-test-preview">
              <strong>{t("ticket.testPreviewTitle")}</strong>
              <p>
                {t("ticket.testVatIncluded", {
                  rate: booking.previewVatPercent,
                  amount: money(booking.previewVatAmount, booking.currency, language),
                })}
              </p>
              <p>{t("ticket.testPreviewWarning")}</p>
              <ul>
                {booking.previewTicketRefs.map((reference, index) => (
                  <li key={reference}>
                    <span>{t("ticket.testReference", { number: index + 1 })}</span>
                    <code>{reference}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
        <TicketActions booking={booking} refundWindowOpen={refundWindowOpen(event)} eventCancelled={event.visibility === "cancelled"} />
        <p><Link href={`/report?booking=${encodeURIComponent(booking.id)}`}>{language === "it" ? "Segnala un problema con questo biglietto" : "Report a problem with this ticket"} ↗</Link></p>
        {booking.mode === "stripe" && booking.status === "confirmed" && (
          <div className="notice">
            {t("ticket.refundHelp", { organizer: event.host })}
          </div>
        )}
      </div>
    </main>
  );
}
