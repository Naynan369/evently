"use client";
import { useState } from "react";
import Link from "next/link";
import { FiCheck, FiArrowRight } from "react-icons/fi";
import { categories } from "@/lib/catalog";
import { recommend } from "@/lib/recommendations";
import { api } from "@/lib/client";
import type { Category, Event, User } from "@/lib/types";
import { musicProviderName, type MusicProfile } from "@/lib/music-types";
import { useApp } from "./AppProvider";
import { CategoryIcon } from "./CategoryIcon";
import EventCard from "./EventCard";
export default function Recommendations({
  events,
  booked = [],
  profiles = [],
}: {
  events: Event[];
  booked?: string[];
  profiles?: MusicProfile[];
}) {
  const { user, saved, setSession, toast } = useApp();
  const [interests, setInterests] = useState<Category[]>(user?.interests || []);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string>(profiles[0]?.source || "");
  const selectedProfile = profiles.find((p) => p.source === source);
  const results = recommend(
    events,
    interests,
    saved,
    booked,
    undefined,
    selectedProfile,
  );
  async function save() {
    setBusy(true);
    try {
      const result = await api<{ user: User }>("interests", {
        method: "PUT",
        body: { interests },
      });
      setSession(result.user);
      toast("Your interests are saved. Let’s find something good.");
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="music-recommend-banner">
        <div>
          <span className="eyebrow">YOUR SOUND. OUT IN THE WORLD.</span>
          <h2>From your playlist to the front row.</h2>
          <p>
            {selectedProfile
              ? "Matching the artists and genres you’ve chosen with upcoming event lineups."
              : "Connect a playlist or choose your favorite artists to make discovery more personal."}
          </p>
        </div>
        <Link className="button button-primary" href="/music">
          {profiles.length ? "Manage my music" : "Find my sound"}{" "}
          <FiArrowRight />
        </Link>
      </div>
      {profiles.length > 0 && (
        <div className="music-source-picker">
          <label htmlFor="music-source">Music source</label>
          <select
            id="music-source"
            value={selectedProfile?.source || ""}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Interests only</option>
            {profiles.map((p) => (
              <option key={p.source} value={p.source}>
                {musicProviderName(p.source)}
              </option>
            ))}
          </select>
          <span>
            Choose which music preferences shape your recommendations.
          </span>
        </div>
      )}
      <div className="interests-panel">
        <h2>A few things you love.</h2>
        <p>
          Pick your interests. Your recommendations update as you choose, with a
          little inspiration from your saved events.
        </p>
        <div className="chip-row">
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={interests.includes(c.id)}
              className={"chip" + (interests.includes(c.id) ? " active" : "")}
              onClick={() =>
                setInterests(
                  interests.includes(c.id)
                    ? interests.filter((i) => i !== c.id)
                    : [...interests, c.id],
                )
              }
            >
              <CategoryIcon id={c.id} />
              {c.name}
              {interests.includes(c.id) && <FiCheck />}
            </button>
          ))}
        </div>
        <div className="interests-actions">
          <p>
            {interests.length
              ? interests.length + " interests selected"
              : "Start with one interest, or explore a little of everything."}
          </p>
          {user ? (
            <button
              className="button button-dark button-small"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Saving…" : "Save my interests"}
              <FiCheck />
            </button>
          ) : (
            <Link href="/register?next=/for-you" className="text-link">
              Create an account to keep your interests <FiArrowRight />
            </Link>
          )}
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR KIND OF OUT THERE</span>
          <h2>
            {interests.length
              ? "A few things you might love."
              : "A little inspiration to start."}
          </h2>
        </div>
        <span className="result-count">
          {selectedProfile
            ? "Music + interests + saved events"
            : "Based on interests and saves"}
        </span>
      </div>
      {results.length ? (
        <div className="event-grid">
          {results.map(({ event, reason }) => (
            <EventCard event={event} reason={reason} key={event.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>You’re all caught up.</h3>
          <p>
            There are no new available events to recommend yet. Check back as
            organizers publish more.
          </p>
          <Link href="/events" className="button button-outline">
            Browse all events
          </Link>
        </div>
      )}
    </>
  );
}
