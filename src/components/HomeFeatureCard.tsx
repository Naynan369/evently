"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { FiArrowUpRight, FiClock, FiMapPin } from "react-icons/fi";
import { categoryName } from "@/lib/catalog";
import { messinaAreaLabel } from "@/lib/messina";
import { eventDate, eventTime, money } from "@/lib/format";
import { translate, type Language } from "@/lib/i18n";
import type { Event } from "@/lib/types";
import { useCardReveal } from "@/components/useCardReveal";

export default function HomeFeatureCard({
  event,
  language,
  index,
}: {
  event: Event;
  language: Language;
  index: number;
}) {
  const cardRef = useCardReveal<HTMLElement>(".home-feature-card__shell");
  const href = `/events/${event.slug}`;
  const image = event.coverImage || `/images/${event.image}.jpg`;
  const soldOut = event.available <= 0;

  return (
    <article
      ref={cardRef}
      className="home-feature-card"
      style={{ "--reveal-delay": `${index * 140}ms` } as CSSProperties}
    >
      <Link
        href={href}
        className="home-feature-card__shell"
        aria-label={`${translate(language, "eventCard.view")} ${event.title}`}
      >
        <Image
          className="home-feature-card__photo"
          src={image}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 33vw"
        />
        <div className="home-feature-card__topline">
          <span className="home-feature-card__category">
            {categoryName(event.category, language)}
          </span>
          {event.sample && (
            <span className="home-feature-card__sample">
              {translate(language, "eventCard.sample")}
            </span>
          )}
        </div>
        <div className="home-feature-card__content">
          <h3>{event.title}</h3>
          <div className="home-feature-card__facts">
            <p>
              <FiClock aria-hidden="true" />
              <time dateTime={event.startsAt}>
                {eventDate(event.startsAt, event.timezone, true, language)} ·{" "}
                {eventTime(event.startsAt, event.timezone, false, language)}
              </time>
            </p>
            <p>
              <FiMapPin aria-hidden="true" />
              <span>
                {event.venue} · {event.area ? messinaAreaLabel(event.area, language) : event.city}
              </span>
            </p>
          </div>
          <div className="home-feature-card__bottom">
            <div className="home-feature-card__price">
              {soldOut ? (
                <small>{translate(language, "events.soldOut")}</small>
              ) : event.price > 0 ? (
                <small>{translate(language, "eventCard.from")}</small>
              ) : null}
              <strong>{money(event.price, event.currency, language)}</strong>
            </div>
            <span className="home-feature-card__arrow" aria-hidden="true">
              <FiArrowUpRight />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
