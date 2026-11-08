"use client";
import Link from "next/link";
import { FiBookmark } from "react-icons/fi";
import { useApp } from "./AppProvider";
import type { Event } from "@/lib/types";
import EventCard from "./EventCard";
export default function SavedEvents({ events }: { events: Event[] }) {
  const { saved, t } = useApp();
  const selected = events.filter((e) => saved.includes(e.id));
  return selected.length ? (
    <div className="event-grid">
      {selected.map((event) => (
        <EventCard event={event} key={event.id} />
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <FiBookmark />
      <h3>{t("saved.emptyTitle")}</h3>
      <p>
        {t("saved.emptyBody")}
      </p>
      <Link className="button button-primary" href="/events">
        {t("saved.findSomething")}
      </Link>
    </div>
  );
}
