"use client";
import Link from "next/link";
import Image from "next/image";
import { FiHeart, FiMapPin, FiArrowUpRight, FiClock } from "react-icons/fi";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { categoryName } from "@/lib/catalog";
import { eventDate, eventTime, money } from "@/lib/format";
import type { Event } from "@/lib/types";
export default function EventCard({
  event,
  reason,
  variant = "standard",
}: {
  event: Event;
  reason?: string;
  variant?: "standard" | "featured" | "compact";
}) {
  const { saved, toggleSave } = useApp();
  const [busy, setBusy] = useState(false);
  const selected = saved.includes(event.id);
  return (
    <article className={"event-card event-card--" + variant}>
      <div className="event-image">
        <Link href={"/events/" + event.slug} tabIndex={-1} aria-hidden="true">
          <Image
            src={"/images/" + event.image + ".jpg"}
            alt=""
            fill
            sizes={
              variant === "featured"
                ? "(max-width: 700px) 100vw, 55vw"
                : "(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
            }
          />
        </Link>
        <time className="date-badge" dateTime={event.startsAt}>
          {eventDate(event.startsAt, event.timezone, true)}
        </time>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await toggleSave(event.id);
            } finally {
              setBusy(false);
            }
          }}
          className={"save-button" + (selected ? " selected" : "")}
          aria-label={(selected ? "Unsave " : "Save ") + event.title}
          aria-pressed={selected}
        >
          <FiHeart />
        </button>
        {event.sample && <span className="sample-label">Sample event</span>}
      </div>
      <div className="event-body">
        <div className="card-category">
          {categoryName(event.category)}
          {reason && <span className="recommendation-reason">✦ {reason}</span>}
        </div>
        <h3>
          <Link href={"/events/" + event.slug}>{event.title}</Link>
        </h3>
        <p className="event-location">
          <FiMapPin />
          {event.venue} · {event.city}
        </p>
        <p className="event-time">
          <FiClock aria-hidden="true" />
          {eventTime(event.startsAt, event.timezone, true)}
        </p>
        {variant === "featured" && (
          <p className="event-summary">{event.description}</p>
        )}
        <div className="card-bottom">
          <span>
            {event.price > 0 && <small>From </small>}
            <strong>{money(event.price, event.currency)}</strong>
            {event.available === 0 && (
              <span className="availability-label">Sold out</span>
            )}
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
