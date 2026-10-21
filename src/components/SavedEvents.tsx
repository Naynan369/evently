"use client";
import Link from "next/link";
import { FiBookmark } from "react-icons/fi";
import { useApp } from "./AppProvider";
import type { Event } from "@/lib/types";
import EventCard from "./EventCard";
export default function SavedEvents({ events }: { events: Event[] }) {
  const { saved } = useApp();
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
      <h3>Keep your next good idea here.</h3>
      <p>
        Save an event from its details page and your collection will be waiting
        whenever you’re ready to make a plan.
      </p>
      <Link className="button button-primary" href="/events">
        Find something to save
      </Link>
    </div>
  );
}
