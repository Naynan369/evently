import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiMusic,
  FiUsers,
} from "react-icons/fi";
import { getEvent, listEvents, discoveryData } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { eventIsPrivate } from "@/lib/demo";
import { categories, categoryName } from "@/lib/catalog";
import { messinaAreaLabel } from "@/lib/messina";
import { eventDate, eventTime } from "@/lib/format";
import { paymentConfigured } from "@/lib/payments";
import { previewVatPercent } from "@/lib/ticket-preview";
import { platformCheckoutTestEnabled } from "@/lib/platform-checkout-test";
import BookingPanel from "@/components/BookingPanel";
import EventCard from "@/components/EventCard";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (event && eventIsPrivate(event)) {
    const user = await currentUser();
    if (event.ownerId !== user?.id)
      return { title: "Event not found", robots: { index: false, follow: false } };
    return {
      title: event.title + " · Private preview",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: event?.title || "Event not found",
    description: event?.description.slice(0, 155),
    ...(platformCheckoutTestEnabled()
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default async function EventDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (categories.some((category) => category.id === slug)) {
    redirect("/events?category=" + slug);
  }

  const aliases: Record<string, string> = {
    sports: "wellness",
    business: "technology",
    education: "technology",
    entertainment: "arts",
  };
  if (aliases[slug]) redirect("/events?category=" + aliases[slug]);

  const event = await getEvent(slug);
  if (!event) notFound();
  const privatePreview = eventIsPrivate(event);
  if (privatePreview && event.ownerId !== (await currentUser())?.id) notFound();
  const language = await getLanguage();
  const t = (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);

  const { now } = await discoveryData();
  const related = (await listEvents())
    .filter(
      (candidate) =>
        candidate.id !== event.id &&
        candidate.category === event.category &&
        Date.parse(candidate.startsAt) > now,
    )
    .slice(0, 3);
  const coverImage = event.coverImage || `/images/${event.image}.jpg`;
  const eventIsFull = event.available < 1;
  const testCheckout =
    platformCheckoutTestEnabled() &&
    !event.sample &&
    (event.price > 0 || Boolean(event.vipCapacity && event.vipPrice));

  return (
    <main id="main" className="container page-main event-detail-page">
      <div className="event-detail-back-row">
        <Link className="event-detail-back" href={privatePreview ? "/organizer" : "/events"}>
          <FiArrowLeft aria-hidden="true" />
          <span>{privatePreview ? (language === "it" ? "Torna allo studio" : "Back to studio") : t("events.back")}</span>
        </Link>
        <span className="event-detail-page-label">{event.visibility === "cancelled" ? (language === "it" ? "ANNULLATO" : "CANCELLED") : privatePreview ? (language === "it" ? "ANTEPRIMA" : "PREVIEW") : t("events.details")}</span>
      </div>

      <header className="event-detail-hero">
        <Image
          src={coverImage}
          alt={`${event.title} event cover`}
          fill
          priority
          sizes="(max-width: 800px) 100vw, 1240px"
        />
        <div className="event-detail-hero-shade" />
        <div className="event-detail-hero-topline">
          <span className="event-detail-category">
            {categoryName(event.category, language)}
          </span>
          {event.sample && (
            <span className="event-detail-sample">
              {t("events.sample")}
            </span>
          )}
          {testCheckout && (
            <span className="event-detail-sample">
              {language === "it" ? "PAGAMENTO DI PROVA" : "TEST PAYMENT"}
            </span>
          )}
          {privatePreview && (
            <span className="event-detail-sample">
              {event.visibility === "cancelled" ? (language === "it" ? "Annullato" : "Cancelled") : event.visibility === "review" ? (language === "it" ? "In revisione" : "In review") : event.visibility === "rejected" ? (language === "it" ? "Da correggere" : "Needs changes") : (language === "it" ? "Bozza" : "Draft")}
            </span>
          )}
        </div>
        <div className="event-detail-hero-copy">
          <p className="event-detail-kicker">
            <span>{eventDate(event.startsAt, event.timezone, false, language)}</span>
            <span aria-hidden="true">·</span>
            <span>{event.city}</span>
          </p>
          <h1>{event.title}</h1>
          <p className="event-detail-hero-venue">
            <FiMapPin aria-hidden="true" />
            <span>{event.venue}</span>
          </p>
        </div>
      </header>

      <div className="event-detail-layout">
        <div className="event-detail-content">
          <section className="event-detail-facts" aria-label={t("events.factsAria")}>
            <div className="event-detail-fact">
              <span className="event-detail-fact-icon">
                <FiCalendar aria-hidden="true" />
              </span>
              <div>
                <span className="event-detail-fact-label">{t("events.date")}</span>
                <strong>{eventDate(event.startsAt, event.timezone, false, language)}</strong>
                <span className="event-detail-fact-note">
                  {eventTime(event.startsAt, event.timezone, true, language)} –{" "}
                  {eventTime(event.endsAt, event.timezone, true, language)}
                </span>
              </div>
            </div>
            <div className="event-detail-fact">
              <span className="event-detail-fact-icon">
                <FiMapPin aria-hidden="true" />
              </span>
              <div>
                <span className="event-detail-fact-label">{t("events.venue")}</span>
                <strong>{event.venue}</strong>
                <span className="event-detail-fact-note">{event.city}</span>
              </div>
            </div>
            <div className="event-detail-fact">
              <span className="event-detail-fact-icon">
                <FiUsers aria-hidden="true" />
              </span>
              <div>
                <span className="event-detail-fact-label">{t("events.admission")}</span>
                <strong>
                  {eventIsFull
                    ? t("events.soldOut")
                    : event.vipCapacity
                      ? t("events.standardVip")
                      : t("events.standardAdmission")}
                </strong>
                <span className="event-detail-fact-note">
                  {eventIsFull
                    ? t("events.noneAvailable")
                    : t(event.available === 1 ? "events.availableTicket" : "events.availableTickets", { count: event.available })}
                </span>
              </div>
            </div>
          </section>

          {(Boolean(event.artists?.length) ||
            Boolean(event.genres?.length)) && (
            <section className="event-detail-section event-detail-lineup">
              <div className="event-detail-section-heading">
                <span className="event-detail-section-icon">
                  <FiMusic aria-hidden="true" />
                </span>
                <div>
                  <span className="event-detail-overline">{t("events.onBill")}</span>
                  <h2>{t("events.soundOfNight")}</h2>
                </div>
              </div>
              {Boolean(event.artists?.length) && (
                <p className="event-detail-artists">
                  {event.artists!.join(" · ")}
                </p>
              )}
              {Boolean(event.genres?.length) && (
                <div className="event-detail-tags">
                  {event.genres?.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="event-detail-section event-detail-about">
            <span className="event-detail-overline">{t("events.about")}</span>
            <h2>{t("events.aboutTitle")}</h2>
            <div className="event-detail-prose">
              {event.description.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {!privatePreview && <p><Link href={`/report?event=${encodeURIComponent(event.id)}`}>{language === "it" ? "Segnala un problema con questo evento" : "Report a problem with this event"} ↗</Link></p>}
          </section>

          <section className="event-detail-section event-detail-location">
            <div className="event-detail-section-heading">
              <span className="event-detail-section-icon">
                <FiMapPin aria-hidden="true" />
              </span>
              <div>
                <span className="event-detail-overline">{t("events.gettingThere")}</span>
                <h2>{t("events.meetVenue")}</h2>
              </div>
            </div>
            <div className="event-detail-location-card">
              <div>
                <strong>{event.venue}</strong>
                <p>{event.address}</p>
                <span>{event.area ? `${messinaAreaLabel(event.area, language)} · ` : ""}{event.city}</span>
                {event.accessNotes && (
                  <div className="event-detail-access-notes">
                    <span className="event-detail-fact-label">{t("events.accessNotes")}</span>
                    <p>{event.accessNotes}</p>
                  </div>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank"
                rel="noreferrer"
                className="event-detail-map-link"
              >
                {t("events.openMaps")} <FiExternalLink aria-hidden="true" />
              </a>
            </div>
          </section>

          <section className="event-detail-section event-detail-organizer">
            <span className="event-detail-overline">{t("events.peopleBehind")}</span>
            <div className="event-detail-organizer-card">
              <div className="event-detail-organizer-avatar" aria-hidden="true">
                {event.host.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <span className="event-detail-organizer-label">
                  {t("events.organizedBy")}
                </span>
                <strong>{event.host}</strong>
                <span className="event-detail-organizer-type">
                  {event.sample ? t("events.sampleOrganizer") : t("events.organizer")}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="event-detail-booking">
          <div className="event-detail-booking-intro">
            <FiClock aria-hidden="true" />
            <span>
              {event.sample
                ? t("events.exploreBooking")
                : eventIsFull
                  ? t("events.currentlySoldOut")
                  : t("events.nextPlan")}
            </span>
          </div>
          {privatePreview ? (
            <div className="booking-panel organizer-preview-panel">
              <h2>{language === "it" ? "Come apparirà l'evento" : "How your event will look"}</h2>
              <p>{language === "it"
                ? "Solo tu puoi vedere questa anteprima. Modifica i dettagli o gestisci gli ospiti nello studio organizzatore."
                : "Only you can see this preview. Edit the details or manage guests in Organizer studio."}</p>
              <Link className="button button-primary" href={"/create-event?edit=" + event.id}>
                {language === "it" ? "Modifica evento" : "Edit event"}
              </Link>
              <Link className="button button-outline" href="/organizer">
                {language === "it" ? "Apri studio" : "Open studio"}
              </Link>
            </div>
          ) : (
            <BookingPanel
              event={event}
              acceptingPayments={paymentConfigured()}
              past={Date.parse(event.startsAt) <= now}
              testVatPercent={previewVatPercent()}
              testCheckout={testCheckout}
            />
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="event-detail-related">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("events.moreToCome")}</span>
              <h2>{t("events.moreInCategory", { category: categoryName(event.category, language).toLowerCase() })}</h2>
            </div>
            <Link className="event-detail-related-link" href="/events">
              {t("home.exploreAll")} <FiExternalLink aria-hidden="true" />
            </Link>
          </div>
          <div className="event-grid">
            {related.map((relatedEvent) => (
              <EventCard event={relatedEvent} key={relatedEvent.id} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
