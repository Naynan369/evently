import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  FiCalendar,
  FiMapPin,
  FiArrowLeft,
  FiExternalLink,
} from "react-icons/fi";
import { getEvent, listEvents, discoveryData } from "@/lib/db";
import { categories, categoryName } from "@/lib/catalog";
import { eventDate, eventTime } from "@/lib/format";
import { paymentConfigured } from "@/lib/payments";
import BookingPanel from "@/components/BookingPanel";
import EventCard from "@/components/EventCard";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  return {
    title: event?.title || "Event not found",
    description: event?.description.slice(0, 155),
  };
}
export default async function EventDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (categories.some((c) => c.id === slug))
    redirect("/events?category=" + slug);
  const aliases: Record<string, string> = {
    sports: "wellness",
    business: "technology",
    education: "technology",
    entertainment: "arts",
  };
  if (aliases[slug]) redirect("/events?category=" + aliases[slug]);
  const event = await getEvent(slug);
  if (!event) notFound();
  const { now } = await discoveryData();
  const related = (await listEvents())
    .filter(
      (e) =>
        e.id !== event.id &&
        e.category === event.category &&
        Date.parse(e.startsAt) > now,
    )
    .slice(0, 3);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading" style={{ paddingBottom: 0 }}>
        <Link className="breadcrumb" href="/events">
          <FiArrowLeft /> Back to discovery
        </Link>
      </div>
      <div className="detail-hero">
        <Image
          src={"/images/" + event.image + ".jpg"}
          alt={event.title + " — event cover"}
          fill
          priority
          sizes="90vw"
        />
        {event.sample && (
          <span className="sample-label">
            Sample event · for exploring Evently
          </span>
        )}
      </div>
      <div className="detail-layout">
        <div className="detail-copy">
          <span className="eyebrow">
            {categoryName(event.category)} · {event.city}
          </span>
          <h1>{event.title}</h1>
          <div className="detail-meta">
            <div>
              <FiCalendar />
              <div>
                <strong>{eventDate(event.startsAt, event.timezone)}</strong>
                <span>
                  {eventTime(event.startsAt, event.timezone)} –{" "}
                  {eventTime(event.endsAt, event.timezone)} · {event.timezone}
                </span>
              </div>
            </div>
            <div>
              <FiMapPin />
              <div>
                <strong>{event.venue}</strong>
                <span>{event.city}</span>
              </div>
            </div>
          </div>
          {(Boolean(event.artists?.length) ||
            Boolean(event.genres?.length)) && (
            <section className="detail-section">
              <h2>The sound of the night.</h2>
              {Boolean(event.artists?.length) && (
                <p>{event.artists!.join(" · ")}</p>
              )}
              <div className="chip-row">
                {event.genres?.map((genre) => (
                  <span className="chip" key={genre}>
                    {genre}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section className="detail-section prose">
            <h2>A little about the experience.</h2>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
          <section className="detail-section">
            <h2>Where we’ll meet.</h2>
            <p style={{ fontSize: 13, marginBottom: 15 }}>
              {event.venue}
              <br />
              {event.address}
            </p>
            <a
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(event.address)
              }
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Open the location in Maps <FiExternalLink />
            </a>
          </section>
          <section className="detail-section">
            <h2>Good people behind good plans.</h2>
            <div className="host-line">
              <div className="avatar">{event.host.slice(0, 1)}</div>
              <div>
                <strong>{event.host}</strong>
                <span>
                  {event.sample ? "Illustrative organizer" : "Event organizer"}
                </span>
              </div>
            </div>
          </section>
        </div>
        <BookingPanel
          event={event}
          acceptingPayments={paymentConfigured()}
          past={Date.parse(event.startsAt) <= now}
        />
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">KEEP THE GOOD TIMES GOING</span>
              <h2>More your kind of thing.</h2>
            </div>
          </div>
          <div className="event-grid">
            {related.map((e) => (
              <EventCard event={e} key={e.id} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
