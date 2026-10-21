"use client";
import Link from "next/link";
import Image from "next/image";
import {
  FiMapPin,
  FiArrowUpRight,
  FiClock,
} from "react-icons/fi";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import ThreeCardMotion from "./ThreeCardMotion";
import { categoryName } from "@/lib/catalog";
import { eventDate, eventTime, money } from "@/lib/format";
import type { Event } from "@/lib/types";
export default function EventCard({
  event,
  reason,
  variant = "standard",
  sequence = 0,
  assemblyStaggerMs = 740,
  showThreeMotion = false,
}: {
  event: Event;
  reason?: string;
  variant?: "standard" | "featured" | "compact";
  sequence?: number;
  assemblyStaggerMs?: number;
  showThreeMotion?: boolean;
}) {
  const [hasEntered, setHasEntered] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const coverSrc = event.coverImage || "/images/" + event.image + ".jpg";
  const isSoldOut = event.available <= 0;
  const isLimited = !isSoldOut && event.available <= event.capacity * 0.08;
  const availability = isSoldOut
    ? "Sold out"
    : isLimited
      ? "Limited tickets"
      : "Tickets available";
  const assemblyDelay = sequence * assemblyStaggerMs;
  const shouldShowThreeMotion = variant !== "standard" || showThreeMotion;

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !("IntersectionObserver" in window)) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.unobserve(card);
        }
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.18 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={cardRef}
      onFocusCapture={() => setHasEntered(true)}
      style={{ "--assembly-delay": `${assemblyDelay}ms` } as CSSProperties}
      className={
        "event-card event-card--" + variant +
        (showThreeMotion ? " event-card--explore-motion" : "") +
        (hasEntered ? " event-card--revealed" : "")
      }
    >
      <div className="event-image">
        <Link href={"/events/" + event.slug} tabIndex={-1} aria-hidden="true">
          <Image
            src={coverSrc}
            alt=""
            fill
            sizes={
              variant === "featured"
                ? "(max-width: 700px) 100vw, 55vw"
                : "(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
            }
          />
        </Link>
        {shouldShowThreeMotion && hasEntered && (
          <ThreeCardMotion delay={assemblyDelay + 180} />
        )}
        {variant !== "standard" && (
          <div className="featured-image-caption">
            <span>{categoryName(event.category)}</span>
            <h3>
              <Link href={"/events/" + event.slug}>{event.title}</Link>
            </h3>
          </div>
        )}
        <time className="date-badge" dateTime={event.startsAt}>
          {eventDate(event.startsAt, event.timezone, true)}
        </time>
        <span
          className={
            "ticket-status" +
            (isSoldOut ? " ticket-status--sold-out" : "") +
            (isLimited ? " ticket-status--limited" : "")
          }
        >
          <span className="ticket-status-dot" aria-hidden="true" />
          {variant === "compact" && availability === "Tickets available"
            ? "Available"
            : availability}
        </span>
        {event.sample && <span className="sample-label">Sample event</span>}
      </div>
      <div className="event-body">
        {variant === "standard" && (
          <>
            <div className="card-category">
              {categoryName(event.category)}
              {reason && (
                <span className="recommendation-reason">✦ {reason}</span>
              )}
            </div>
            <h3>
              <Link href={"/events/" + event.slug}>{event.title}</Link>
            </h3>
          </>
        )}
        <div className="event-card-meta">
          <p className="event-location">
            <FiMapPin aria-hidden="true" />
            <span>{event.venue} · {event.city}</span>
          </p>
          <p className="event-time">
            <FiClock aria-hidden="true" />
            <span>{eventTime(event.startsAt, event.timezone)}</span>
          </p>
        </div>
        {variant !== "standard" && (
          <p className="event-summary">{event.description}</p>
        )}
        <div className="card-bottom">
          <span>
            {event.price > 0 && <small>From </small>}
            <strong>{money(event.price, event.currency)}</strong>
          </span>
          <Link
            href={"/events/" + event.slug}
            className="card-arrow"
            aria-label={"View " + event.title}
          >
            <span>View event</span>
            <FiArrowUpRight />
          </Link>
        </div>
      </div>
    </article>
  );
}
