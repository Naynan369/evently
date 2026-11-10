"use client";
import Link from "next/link";
import Image from "next/image";
import { FiMapPin, FiArrowUpRight, FiClock } from "react-icons/fi";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import EventCardUnfurl from "./EventCardUnfurl";
import { categoryName } from "@/lib/catalog";
import { messinaAreaLabel } from "@/lib/messina";
import { eventDate, eventTime, money } from "@/lib/format";
import type { Event } from "@/lib/types";
import { useApp } from "./AppProvider";

export default function EventCard({
  event,
  reason,
  variant = "standard",
  sequence = 0,
  motionStaggerMs = 90,
  showUnfurl = false,
  editorialMotion = false,
}: {
  event: Event;
  reason?: string;
  variant?: "standard" | "featured" | "compact";
  sequence?: number;
  motionStaggerMs?: number;
  showUnfurl?: boolean;
  editorialMotion?: boolean;
}) {
  const { language, t } = useApp();
  const [hasEntered, setHasEntered] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const pointerFrame = useRef<number | null>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const coverSrc = event.coverImage || "/images/" + event.image + ".jpg";
  const isSoldOut = event.available <= 0;
  const isLimited = !isSoldOut && event.available <= event.capacity * 0.08;
  const availability = isSoldOut
    ? t("events.soldOut")
    : isLimited
      ? t("eventCard.limited")
      : t("eventCard.available");
  const motionDelay = Math.min(sequence, 5) * motionStaggerMs;
  const shouldShowUnfurl = !editorialMotion && (variant !== "standard" || showUnfurl);

  function applyPointerMotion() {
    pointerFrame.current = null;
    const card = cardRef.current;
    if (!card) return;
    const { x, y } = pointerPosition.current;
    card.style.setProperty("--card-rotate-x", `${(-y * 1.1).toFixed(2)}deg`);
    card.style.setProperty("--card-rotate-y", `${(x * 1.1).toFixed(2)}deg`);
    card.style.setProperty("--card-image-x", `${(x * 4).toFixed(1)}px`);
    card.style.setProperty("--card-image-y", `${(y * 3).toFixed(1)}px`);
    card.style.setProperty("--card-spot-x", `${(x + 1) * 50}%`);
    card.style.setProperty("--card-spot-y", `${(y + 1) * 50}%`);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (
      editorialMotion ||
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerPosition.current = {
      x: Math.max(
        -1,
        Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
      ),
      y: Math.max(
        -1,
        Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
      ),
    };
    if (pointerFrame.current === null) {
      pointerFrame.current = window.requestAnimationFrame(applyPointerMotion);
    }
  }

  function clearPointerMotion() {
    if (pointerFrame.current !== null) {
      window.cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = null;
    }
    const card = cardRef.current;
    if (!card) return;
    for (const property of [
      "--card-rotate-x",
      "--card-rotate-y",
      "--card-image-x",
      "--card-image-y",
      "--card-spot-x",
      "--card-spot-y",
    ])
      card.style.removeProperty(property);
  }

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
    return () => {
      observer.disconnect();
      if (pointerFrame.current !== null)
        window.cancelAnimationFrame(pointerFrame.current);
    };
  }, []);

  return (
    <article
      ref={cardRef}
      onFocusCapture={() => setHasEntered(true)}
      onPointerMove={editorialMotion ? undefined : handlePointerMove}
      onPointerLeave={clearPointerMotion}
      onPointerCancel={clearPointerMotion}
      style={
        {
          "--motion-delay": `${motionDelay}ms`,
        } as CSSProperties
      }
      className={
        "event-card event-card--" +
        variant +
        (showUnfurl ? " event-card--unfurl" : "") +
        (editorialMotion ? " event-card--editorial" : "") +
        (hasEntered ? " event-card--revealed" : "")
      }
    >
      <div className="event-image">
        <Link href={"/events/" + event.slug} tabIndex={-1} aria-hidden="true">
          <Image
            src={coverSrc}
            className="event-card-cover"
            alt=""
            fill
            sizes={
              variant === "featured"
                ? "(max-width: 700px) 100vw, 55vw"
                : "(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
            }
          />
        </Link>
        {shouldShowUnfurl && hasEntered && (
          <EventCardUnfurl delay={motionDelay + 120} />
        )}
        {variant !== "standard" && !(editorialMotion && variant === "compact") && (
          <div className="featured-image-caption">
            <span>{categoryName(event.category, language)}</span>
            <h3>
              <Link href={"/events/" + event.slug}>{event.title}</Link>
            </h3>
          </div>
        )}
        <time className="date-badge" dateTime={event.startsAt}>
          {eventDate(event.startsAt, event.timezone, true, language)}
        </time>
        <span
          className={
            "ticket-status" +
            (isSoldOut ? " ticket-status--sold-out" : "") +
            (isLimited ? " ticket-status--limited" : "")
          }
        >
          <span className="ticket-status-dot" aria-hidden="true" />
          {variant === "compact" && !isSoldOut && !isLimited
            ? t("eventCard.availableShort")
            : availability}
        </span>
        {event.sample && (
          <span className="sample-label">{t("eventCard.sample")}</span>
        )}
      </div>
      <div className="event-body">
        {(variant === "standard" || (editorialMotion && variant === "compact")) && (
          <>
            <div className="card-category">
              {categoryName(event.category, language)}
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
            <span>
              {event.venue} · {event.area ? messinaAreaLabel(event.area, language) : event.city}
            </span>
          </p>
          <p className="event-time">
            <FiClock aria-hidden="true" />
            <span>
              {eventTime(event.startsAt, event.timezone, false, language)}
            </span>
          </p>
        </div>
        {variant !== "standard" && (
          <p className="event-summary">{event.description}</p>
        )}
        <div className="card-bottom">
          <span>
            {event.price > 0 && <small>{t("eventCard.from")} </small>}
            <strong>{money(event.price, event.currency, language)}</strong>
          </span>
          <Link
            href={"/events/" + event.slug}
            className="card-arrow"
            aria-label={t("eventCard.view") + " " + event.title}
          >
            <span>{t("eventCard.view")}</span>
            <FiArrowUpRight />
          </Link>
        </div>
      </div>
    </article>
  );
}
