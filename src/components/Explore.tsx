"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiSearch, FiX, FiGrid, FiList } from "react-icons/fi";
import { categories, categoryName } from "@/lib/catalog";
import type { Event } from "@/lib/types";
import EventCard from "./EventCard";
import { SearchForm } from "./SearchForm";
import { useApp } from "./AppProvider";
export default function Explore({
  events,
  initial,
}: {
  events: Event[];
  initial: { q: string; city: string; category: string; price: string };
}) {
  const { language, t } = useApp();
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
        <div className="chip-row" aria-label={t("explore.categoriesAria")}>
          <button
            className={"chip" + (!category ? " active" : "")}
            onClick={() => setCategory("")}
            aria-pressed={!category}
          >
            {t("explore.all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={"chip" + (category === c.id ? " active" : "")}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
            >
              {categoryName(c.id, language)}
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <label>
            <span className="sr-only">{t("explore.price")}</span>
            <select value={price} onChange={(e) => setPrice(e.target.value)}>
              <option value="">{t("explore.anyPrice")}</option>
              <option value="free">{t("explore.free")}</option>
              <option value="paid">{t("explore.paid")}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{t("explore.date")}</span>
            <select value={when} onChange={(e) => setWhen(e.target.value)}>
              <option value="">{t("explore.anyDate")}</option>
              <option value="week">{t("explore.nextWeek")}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{t("explore.sort")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">{t("explore.soonest")}</option>
              <option value="price">{t("explore.lowestPrice")}</option>
              <option value="title">{t("explore.az")}</option>
            </select>
          </label>
        </div>
      </div>
      <div className="results-toolbar">
        <p className="result-count" role="status">
          {new Intl.NumberFormat(language === "it" ? "it-IT" : "en-GB").format(filtered.length)}{" "}
          {t(filtered.length === 1 ? "explore.experience" : "explore.experiences")}
          {initial.q ? t("explore.queryResults", { query: initial.q }) : ""}
          {initial.city ? t("explore.cityResults", { city: initial.city }) : ""}
        </p>
        <div className="view-toggle" role="group" aria-label={t("explore.layout")}>
          <button
            aria-label={t("explore.gridAria")}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <FiGrid /> <span>{t("explore.grid")}</span>
          </button>
          <button
            aria-label={t("explore.listAria")}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <FiList /> <span>{t("explore.list")}</span>
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
              showUnfurl
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FiSearch />
          <h3>{t("explore.emptyTitle")}</h3>
          <p>
            {t("explore.emptyBody")}
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
            <FiX /> {t("explore.clearFilters")}
          </Link>
        </div>
      )}
    </>
  );
}
