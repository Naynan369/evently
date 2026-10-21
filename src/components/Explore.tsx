"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiSearch, FiX, FiGrid, FiList } from "react-icons/fi";
import { categories } from "@/lib/catalog";
import type { Event } from "@/lib/types";
import EventCard from "./EventCard";
import { SearchForm } from "./SearchForm";
export default function Explore({
  events,
  initial,
}: {
  events: Event[];
  initial: { q: string; city: string; category: string; price: string };
}) {
  const [now] = useState(() => Date.now());
  const [category, setCategory] = useState(initial.category);
  const [price, setPrice] = useState(initial.price);
  const [when, setWhen] = useState("");
  const [sort, setSort] = useState("date");
  const [view, setView] = useState<"grid" | "list">("grid");
  const filtered = useMemo(
    () =>
      events
        .filter(
          (e) =>
            (!category || e.category === category) &&
            (!initial.city ||
              e.city.toLowerCase() === initial.city.trim().toLowerCase()) &&
            (!initial.q ||
              [e.title, e.description, e.venue, e.city]
                .join(" ")
                .toLowerCase()
                .includes(initial.q.toLowerCase())) &&
            (price !== "free" || e.price === 0) &&
            (price !== "paid" || e.price > 0) &&
            (when !== "week" || Date.parse(e.startsAt) < now + 7 * 86400000),
        )
        .sort((a, b) =>
          sort === "price"
            ? a.price - b.price
            : sort === "title"
              ? a.title.localeCompare(b.title)
              : a.startsAt.localeCompare(b.startsAt),
        ),
    [events, category, price, when, sort, initial, now],
  );
  return (
    <>
      <SearchForm query={initial.q} city={initial.city} />
      <div className="filter-bar">
        <div className="chip-row" aria-label="Event categories">
          <button
            className={"chip" + (!category ? " active" : "")}
            onClick={() => setCategory("")}
            aria-pressed={!category}
          >
            All experiences
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={"chip" + (category === c.id ? " active" : "")}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <label>
            <span className="sr-only">Price</span>
            <select value={price} onChange={(e) => setPrice(e.target.value)}>
              <option value="">Any price</option>
              <option value="free">Free events</option>
              <option value="paid">Paid events</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Date</span>
            <select value={when} onChange={(e) => setWhen(e.target.value)}>
              <option value="">Any date</option>
              <option value="week">Next 7 days</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort events</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">Soonest first</option>
              <option value="price">Lowest price</option>
              <option value="title">A to Z</option>
            </select>
          </label>
        </div>
      </div>
      <div className="results-toolbar">
        <p className="result-count" role="status">
          {filtered.length} experience{filtered.length !== 1 ? "s" : ""} to look
          forward to{initial.q ? " for “" + initial.q + "”" : ""}
          {initial.city ? " in " + initial.city : ""}
        </p>
        <div className="view-toggle" role="group" aria-label="Event layout">
          <button
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <FiGrid /> <span>Grid</span>
          </button>
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <FiList /> <span>List</span>
          </button>
        </div>
      </div>
      {filtered.length ? (
        <div className={"event-grid" + (view === "list" ? " event-list" : "")}>
          {filtered.map((event, index) => (
            <EventCard
              event={event}
              key={`${category || "all"}:${event.id}`}
              sequence={index % 3}
              showThreeMotion
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FiSearch />
          <h3>Let’s try a different direction.</h3>
          <p>
            No events match all your filters. Try another search, city or
            category.
          </p>
          <Link
            href="/events"
            className="button button-outline"
            onClick={() => {
              setCategory("");
              setPrice("");
              setWhen("");
              setSort("date");
            }}
          >
            <FiX /> Clear all filters
          </Link>
        </div>
      )}
    </>
  );
}
