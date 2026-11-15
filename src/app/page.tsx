import Link from "next/link";
import {
  FiArrowUpRight,
  FiCalendar,
  FiLayout,
  FiUsers,
} from "react-icons/fi";
import HomeFeatureCard from "@/components/HomeFeatureCard";
import HomeCategoryCard from "@/components/HomeCategoryCard";
import EventCinema from "@/components/EventCinema";
import MessinaGuide from "@/components/MessinaGuide";
import { categories, categoryName, categoryTagline } from "@/lib/catalog";
import { isMessinaCity } from "@/lib/messina";
import { discoveryData } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const organizerTools = [
  {
    label: "home.toolPages",
    description: "home.toolPagesDescription",
    icon: FiLayout,
  },
  {
    label: "home.toolCheckout",
    description: "home.toolCheckoutDescription",
    icon: FiCalendar,
  },
  {
    label: "home.toolGuests",
    description: "home.toolGuestsDescription",
    icon: FiUsers,
  },
] as const;

export default async function Home() {
  const language = await getLanguage();
  const t = (key: TranslationKey) => translate(language, key);
  const [discovery, user] = await Promise.all([discoveryData(), currentUser()]);
  const events = discovery.events;
  const showOrganizerInvitation = !user || user.isOrganizer;
  const createEventHref = user
    ? "/create-event"
    : "/register?type=organizer&next=/create-event";
  const featured = [
    ...events.filter((e) => !e.sample && isMessinaCity(e.city)),
    ...events.filter((e) => !e.sample && !isMessinaCity(e.city)),
    ...events.filter((e) => e.sample),
  ].slice(0, 3);
  return (
    <main id="main" className="home-cinema">
      <EventCinema />
      <MessinaGuide language={language} />
      <section className="featured-section">
        <div className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("home.featured")}</span>
              <h2>{t("home.worthTime")}</h2>
            </div>
            <Link className="home-featured-all" href="/events">
              {t("home.exploreAll")} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          {featured.length ? (
            <div className="home-featured-grid" data-count={featured.length}>
              {featured.map((event, index) => (
                <HomeFeatureCard
                  key={event.id}
                  event={event}
                  language={language}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{t("home.greatExperiences")}</h3>
              <p>{t("home.firstToBring")}</p>
              {showOrganizerInvitation && (
                <Link className="button button-primary" href={createEventHref}>
                  {t("nav.createEvent")}
                </Link>
              )}
            </div>
          )}
          {featured.some((event) => event.sample) && (
            <p className="section-footnote">{t("home.sampleListings")}</p>
          )}
        </div>
      </section>
      <section
        id="home-categories"
        className="container section category-section home-category-section"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("home.categories")}</span>
            <h2>{t("home.findExperience")}</h2>
          </div>
        </div>
        <div className="category-grid home-category-grid">
          {categories.map((c, index) => (
            <HomeCategoryCard
              key={c.id}
              id={c.id}
              name={categoryName(c.id, language)}
              tagline={categoryTagline(c.id, language)}
              index={index}
            />
          ))}
        </div>
      </section>
      {showOrganizerInvitation && (
        <section className="container organizer-banner">
          <div className="organizer-intro">
            <span className="eyebrow organizer-label">
              <span className="organizer-label-dot" aria-hidden="true" />
              {t("home.organizers")}
            </span>
            <h2>{t("home.smootherEvents")}</h2>
            <p>{t("home.organizerBody")}</p>
            <Link className="button button-primary" href={createEventHref}>
              {t("home.startOrganizing")} <FiArrowUpRight />
            </Link>
          </div>
          <ul className="organizer-points" aria-label={t("home.organizerTools")}>
            {organizerTools.map(({ label, description, icon: Icon }) => (
              <li key={label}>
                <span className="organizer-tool-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="organizer-tool-copy">
                  <strong>{t(label)}</strong>
                  <span>{t(description)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
