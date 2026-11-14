import Link from "next/link";
import Image from "next/image";
import {
  FiArrowUpRight,
  FiCalendar,
  FiLayout,
  FiUsers,
} from "react-icons/fi";
import HomeFeatureCard from "@/components/HomeFeatureCard";
import HomeCategoryCard from "@/components/HomeCategoryCard";
import EventCinema from "@/components/EventCinema";
import { categories, categoryName, categoryTagline } from "@/lib/catalog";
import { messinaAreas, isMessinaCity } from "@/lib/messina";
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
  const events = (await discoveryData()).events;
  const featured = [
    ...events.filter((e) => !e.sample && isMessinaCity(e.city)),
    ...events.filter((e) => !e.sample && !isMessinaCity(e.city)),
    ...events.filter((e) => e.sample),
  ].slice(0, 3);
  return (
    <main id="main" className="home-cinema">
      <EventCinema />
      <section className="messina-home-section" aria-labelledby="messina-home-title">
        <div className="container">
          <div className="messina-home-topline">
            <span>{t("home.messinaEyebrow")}</span>
            <span>{t("home.messinaLocation")}</span>
          </div>
          <div className="messina-home-hero">
            <Image
              src="/images/messina-night.jpg"
              alt={t("home.messinaPhotoAlt")}
              fill
              sizes="(max-width: 760px) 100vw, 1280px"
            />
            <div className="messina-home-heading">
              <h2 id="messina-home-title">{t("home.messinaTitle")}</h2>
              <p>{t("home.messinaIntro")}</p>
            </div>
          </div>
          <div className="messina-home-directory-heading" aria-hidden="true">
            <span>{t("home.messinaAreas")}</span>
            <span>{String(messinaAreas.length).padStart(2, "0")}</span>
          </div>
          <nav className="messina-home-areas" aria-label={t("home.messinaAreas")}>
            {messinaAreas.map((area, index) => (
              <Link
                href={`/events?city=Messina&area=${area.id}`}
                className="messina-home-area"
                key={area.id}
              >
                <span className="messina-home-area__number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{area[language]}</strong>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="messina-home-links">
            <Link href="/events?city=Messina">{t("home.messinaAll")} <FiArrowUpRight aria-hidden="true" /></Link>
            <Link href="/events?city=Messina&price=free">{t("home.messinaFree")} <FiArrowUpRight aria-hidden="true" /></Link>
            <Link href="/events?city=Messina&category=community">{t("home.messinaCommunity")} <FiArrowUpRight aria-hidden="true" /></Link>
          </div>
          <div className="messina-home-host">
            <div>
              <h3>{t("home.messinaHostTitle")}</h3>
              <p>{t("home.messinaHostBody")}</p>
            </div>
            <Link href="/create-event" className="button button-primary">
              {t("home.messinaHostAction")} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
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
              <Link className="button button-primary" href="/create-event">
                {t("nav.createEvent")}
              </Link>
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
