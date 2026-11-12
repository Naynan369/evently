"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCalendar,
  FiCheck,
  FiClock,
  FiMapPin,
  FiMusic,
  FiSliders,
} from "react-icons/fi";
import { categories, categoryName } from "@/lib/catalog";
import { recommend } from "@/lib/recommendations";
import { eventDate, eventTime, money } from "@/lib/format";
import { api } from "@/lib/client";
import type { Category, Event, User } from "@/lib/types";
import { musicProviderName, type MusicProfile } from "@/lib/music/music-types";
import { useApp } from "./AppProvider";
import { CategoryIcon } from "./CategoryIcon";

function eventImage(event: Event) {
  return event.coverImage || "/images/" + event.image + ".jpg";
}

function LeadRecommendation({
  event,
  reason,
}: {
  event: Event;
  reason: string;
}) {
  const { language, t } = useApp();
  const limited = event.available <= event.capacity * 0.08;

  return (
    <article className="fy-lead">
      <Link
        href={"/events/" + event.slug}
        className="fy-lead-image"
        aria-label={t("recommendation.view") + " " + event.title}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={eventImage(event)}
          alt=""
          fill
          priority
          sizes="(max-width: 920px) 100vw, 56vw"
        />
      </Link>
      <div className="fy-lead-shade" aria-hidden="true" />
      <div className="fy-lead-topline">
        <span className="fy-pick-label">{t("recommendation.strong")}</span>
        <time dateTime={event.startsAt}>
          <FiCalendar aria-hidden="true" />
          {eventDate(event.startsAt, event.timezone, true, language)}
        </time>
      </div>
      <div className="fy-lead-copy">
        <span className="fy-lead-category">{categoryName(event.category, language)}</span>
        <h2>
          <Link href={"/events/" + event.slug}>{event.title}</Link>
        </h2>
        <p className="fy-lead-location">
          <FiMapPin aria-hidden="true" />
          {event.venue} · {event.city}
        </p>
        <div className="fy-lead-bottom">
          <div>
            <span className="fy-match-note">{reason}</span>
            <span className="fy-lead-price">
              {event.price > 0 && <small>{t("recommendation.from")} </small>}
              {money(event.price, event.currency, language)}
            </span>
          </div>
          <Link href={"/events/" + event.slug} className="fy-lead-link">
            {t("recommendation.seeDetails")} <FiArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <span className={"fy-availability" + (limited ? " is-limited" : "")}>
          <span aria-hidden="true" />
          {limited ? t("eventCard.limited") : t("eventCard.available")}
        </span>
      </div>
    </article>
  );
}

function RecommendationRow({
  event,
  reason,
}: {
  event: Event;
  reason: string;
}) {
  const { language, t } = useApp();
  return (
    <article className="fy-result">
      <Link
        href={"/events/" + event.slug}
        className="fy-result-image"
        aria-label={t("recommendation.view") + " " + event.title}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={eventImage(event)}
          alt=""
          fill
          sizes="(max-width: 720px) 100vw, 190px"
        />
        <time dateTime={event.startsAt}>
          {eventDate(event.startsAt, event.timezone, true, language)}
        </time>
      </Link>
      <div className="fy-result-copy">
        <div className="fy-result-topline">
          <span>{categoryName(event.category, language)}</span>
          {event.sample && <small>{t("eventCard.sample")}</small>}
        </div>
        <h3>
          <Link href={"/events/" + event.slug}>{event.title}</Link>
        </h3>
        <p className="fy-result-place">
          <FiMapPin aria-hidden="true" />
          {event.venue} · {event.city}
          <span className="fy-result-time">
            <FiClock aria-hidden="true" />
            {eventTime(event.startsAt, event.timezone, false, language)}
          </span>
        </p>
        <div className="fy-result-bottom">
          <span className="fy-result-reason">{reason}</span>
          <span className="fy-result-price">{money(event.price, event.currency, language)}</span>
          <Link
            href={"/events/" + event.slug}
            className="fy-result-link"
            aria-label={t("recommendation.ariaDetails") + " " + event.title}
          >
            <FiArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function Recommendations({
  events,
  booked = [],
  profiles = [],
}: {
  events: Event[];
  booked?: string[];
  profiles?: MusicProfile[];
}) {
  const { user, saved, setSession, toast, language, t } = useApp();
  const [interests, setInterests] = useState<Category[]>(user?.interests || []);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string>(profiles[0]?.source || "");
  const selectedProfile = profiles.find((profile) => profile.source === source);
  const results = useMemo(
    () => recommend(events, interests, saved, booked, undefined, selectedProfile),
    [events, interests, saved, booked, selectedProfile],
  );
  const lead = results[0];
  const moreResults = results.slice(1);

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ user: User }>("interests", {
        method: "PUT",
        body: { interests },
      });
      setSession(result.user);
      toast(t("recommendation.savedToast"));
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fy-overline">
        <span><i aria-hidden="true" /> {t("recommendation.header")}</span>
        <span>{t("recommendation.picks")}</span>
      </div>

      <header className="fy-hero">
        <div className="fy-hero-copy">
          <span className="fy-eyebrow">{t("recommendation.eyebrow")}</span>
          <h1>
            {t("recommendation.title")}
            <br />
            <em>{t("recommendation.titleEmphasis")}</em>
          </h1>
          <p>{t("recommendation.intro")}</p>
          {selectedProfile && (
            <div className="fy-connected-source">
              <FiMusic aria-hidden="true" />
              {t("recommendation.matchedWith", { provider: musicProviderName(selectedProfile.source) })}
            </div>
          )}
        </div>

        {lead ? (
          <LeadRecommendation event={lead.event} reason={lead.reason} />
        ) : (
          <div className="fy-lead fy-lead-empty">
            <span className="fy-empty-overline">{t("recommendation.room")}</span>
            <h2>{t("recommendation.nextStillThere")}</h2>
            <p>{t("recommendation.widen")}</p>
            <Link href="/events" className="fy-lead-link">
              {t("recommendation.browse")} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </header>

      <div className="fy-layout">
        <aside className="fy-controls" aria-label={t("recommendation.personalize")}>
          <div className="fy-controls-heading">
            <span className="fy-section-label"><FiSliders aria-hidden="true" /> {t("recommendation.taste")}</span>
            <h2>{t("recommendation.direction")}</h2>
            <p>{t("recommendation.chooseMore")}</p>
          </div>

          <div className="fy-interest-list" aria-label={t("recommendation.interests")}>
            {categories.map((category) => {
              const active = interests.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={active}
                  className={"fy-interest" + (active ? " is-active" : "")}
                  onClick={() =>
                    setInterests(
                      active
                        ? interests.filter((interest) => interest !== category.id)
                        : [...interests, category.id],
                    )
                  }
                >
                  <span className="fy-interest-icon"><CategoryIcon id={category.id} /></span>
                  <span>{categoryName(category.id, language)}</span>
                  <span className="fy-interest-check" aria-hidden="true">
                    {active && <FiCheck />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="fy-music-source">
            <span className="fy-section-label"><FiMusic aria-hidden="true" /> {t("recommendation.musicSignal")}</span>
            {profiles.length ? (
              <>
                <label htmlFor="fy-music-source">{t("recommendation.useSource")}</label>
                <select
                  id="fy-music-source"
                  value={selectedProfile?.source || ""}
                  onChange={(event) => setSource(event.target.value)}
                >
                  <option value="">{t("recommendation.interestsOnly")}</option>
                  {profiles.map((profile) => (
                    <option key={profile.source} value={profile.source}>
                      {musicProviderName(profile.source)}
                    </option>
                  ))}
                </select>
                <p>{t("recommendation.musicShapes")}</p>
              </>
            ) : (
              <Link href="/music" className="fy-connect-music">
                <span>
                  <strong>{t("recommendation.addMusic")}</strong>
                  <small>{t("recommendation.connectSource")}</small>
                </span>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="fy-controls-footer">
            <span>
              {interests.length
                ? t(interests.length === 1 ? "recommendation.interestCountOne" : "recommendation.interestCount", { count: interests.length })
                : t("recommendation.openAll")}
            </span>
            {user ? (
              <button
                type="button"
                className="fy-save-button"
                disabled={busy}
                onClick={save}
              >
                {busy ? t("recommendation.saving") : t("recommendation.saveTaste")}
                <FiArrowRight aria-hidden="true" />
              </button>
            ) : (
              <Link href="/register?next=/for-you" className="fy-signup-link">
                {t("recommendation.keepPreferences")} <FiArrowUpRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </aside>

        <section className="fy-feed" aria-labelledby="fy-feed-heading">
          <div className="fy-feed-heading">
            <div>
              <span className="fy-section-label">{t("recommendation.rest")}</span>
              <h2 id="fy-feed-heading">{t("recommendation.moreWorth")}</h2>
            </div>
            <span className="fy-feed-count">
              {t("recommendation.moreCount", { count: moreResults.length.toString().padStart(2, "0") })}
            </span>
          </div>

          {moreResults.length ? (
            <div className="fy-results">
              {moreResults.map(({ event, reason }) => (
                <RecommendationRow event={event} reason={reason} key={event.id} />
              ))}
            </div>
          ) : lead ? (
            <div className="fy-feed-note">
              <span className="fy-note-mark" aria-hidden="true">✳</span>
              <div>
                <h3>{t("recommendation.shortlist")}</h3>
                <p>{t("recommendation.moreInterests")}</p>
              </div>
              <Link href="/events" aria-label={t("recommendation.browseAll")}>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="fy-feed-note fy-feed-note-empty">
              <span className="fy-note-mark" aria-hidden="true">✳</span>
              <div>
                <h3>{t("recommendation.nothingToMatch")}</h3>
                <p>{t("recommendation.widenOrBrowse")}</p>
              </div>
              <Link href="/events" aria-label={t("recommendation.browseAll")}>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
