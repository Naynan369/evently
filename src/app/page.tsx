import Link from "next/link";
import {
  FiArrowUpRight,
  FiCreditCard,
  FiLayout,
  FiUsers,
} from "react-icons/fi";
import EventCard from "@/components/EventCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import EventCinema from "@/components/EventCinema";
import { categories, categoryName, categoryTagline } from "@/lib/catalog";
import { discoveryData } from "@/lib/db";
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
    icon: FiCreditCard,
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
  const events = (await discoveryData()).events;
  const featured = [
    ...events.filter((e) => !e.sample),
    ...events.filter((e) => e.sample),
  ].slice(0, 3);
  return (
    <main id="main" className="home-cinema">
      <EventCinema />
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
                <EventCard
                  key={event.id}
                  event={event}
                  variant="standard"
                  sequence={index}
                  motionStaggerMs={130}
                  editorialMotion
                  scene3D
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{t("home.greatExperiences")}</h3>
              <p>{t("home.firstToBring")}</p>
              <Link className="button button-primary" href="/create-event">
                {t("nav.createEvent")}
              </Link>
            </div>
          )}
          <p className="section-footnote">
            {t("home.sampleListings")}
          </p>
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
          {categories.map((c) => (
            <Link
              href={"/events?category=" + c.id}
              className="category-card"
              key={c.id}
            >
              <span className={"category-icon " + c.color}>
                <CategoryIcon id={c.id} />
              </span>
              <span className="category-copy">
                <strong>{categoryName(c.id, language)}</strong>
                <span>{categoryTagline(c.id, language)}</span>
              </span>
              <FiArrowUpRight className="category-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <section className="container organizer-banner">
        <div className="organizer-intro">
          <span className="eyebrow organizer-label">
            <span className="organizer-label-dot" aria-hidden="true" />
            {t("home.organizers")}
          </span>
          <h2>{t("home.smootherEvents")}</h2>
          <p>
            {t("home.organizerBody")}
          </p>
          <Link className="button button-primary" href="/create-event">
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
    </main>
  );
}
