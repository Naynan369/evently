"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { FiArrowUpRight, FiArrowRight, FiPause, FiPlay } from "react-icons/fi";
import { SearchForm } from "./SearchForm";
import { useApp } from "./AppProvider";
import MusicVisualizer from "./MusicVisualizer";
import type { TranslationKey } from "@/lib/i18n";

const collection = [
  {
    labelKey: "home.clubNights",
    titleKey: "home.clubNightsTitle",
    descriptionKey: "home.clubNightsDescription",
  },
  {
    labelKey: "home.goodCompany",
    titleKey: "home.goodCompanyTitle",
    descriptionKey: "home.goodCompanyDescription",
  },
  {
    labelKey: "home.openHorizons",
    titleKey: "home.openHorizonsTitle",
    descriptionKey: "home.openHorizonsDescription",
  },
] satisfies {
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}[];

export default function EventCinema() {
  const { t } = useApp();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const slide = collection[index];

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setPlaying(!reducedMotion.matches);

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);
    return () =>
      reducedMotion.removeEventListener("change", syncMotionPreference);
  }, []);

  return (
    <section className="event-cinema" aria-label={t("home.chooseCollection")}>
      <div className={`cinema-media cinema-media--${index}`}>
        <div className="cinema-photo" aria-hidden="true">
          <Image
            src="/images/club-photo.jpg"
            alt=""
            fill
            sizes="100vw"
            preload
          />
        </div>
        <div className="cinema-shade" />
        <MusicVisualizer mode={index} playing={playing} />
      </div>
      <div className="container cinema-content">
        <div className="cinema-eyebrow">
          <span className="live-dot" /> {t("home.liveExperiences")}
        </div>
        <h1>
          {t("home.title")}
          <br />
          <em>{t("home.titleEmphasis")}</em>
        </h1>
        <p className="cinema-intro">{t("home.intro")}</p>
        <div className="cinema-ctas">
          <Link className="button button-primary" href="/events">
            {t("home.exploreEvents")} <FiArrowUpRight />
          </Link>
          <Link className="cinema-music-link" href="#home-categories">
            {t("nav.discovery.categories")} <FiArrowRight />
          </Link>
        </div>
        <div className="cinema-bottom">
          <div className="collection-label" aria-live="polite">
            <span>
              {t("home.collection")} / 0{index + 1}
            </span>
            <h2>{t(slide.titleKey)}</h2>
            <p>{t(slide.descriptionKey)}</p>
          </div>
          <div className="cinema-controls">
            <span className="cinema-motion-caption">
              {t("home.animationCaption")}
            </span>
            <button
              className="cinema-play"
              aria-label={
                playing ? t("home.pauseAnimation") : t("home.playAnimation")
              }
              aria-pressed={playing}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <FiPause /> : <FiPlay />}
            </button>
          </div>
        </div>
        <div
          className="collection-tabs"
          role="group"
          aria-label={t("home.chooseCollection")}
        >
          {collection.map((item, i) => (
            <button
              key={item.labelKey}
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
            >
              <span>0{i + 1}</span>
              {t(item.labelKey)}
              <span className="collection-progress" />
            </button>
          ))}
        </div>
      </div>
      <div className="container cinema-search">
        <SearchForm city="Messina" />
        <div className="popular-searches">
          <span>{t("home.popularSearches")}</span>
          <Link href="/events?category=music">{t("common.liveMusic")}</Link>
          <Link href="/events?price=free">{t("common.freeThings")}</Link>
        </div>
      </div>
    </section>
  );
}
