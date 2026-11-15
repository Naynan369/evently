"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import MessinaGuideVisualizer from "./MessinaGuideVisualizer";
import { messinaAreas, type MessinaArea } from "@/lib/messina";
import { messinaAreaPhotos } from "@/lib/messina-photos";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";

const areaNotes: Record<MessinaArea, Record<Language, string>> = {
  centro: { en: "In and around the city centre", it: "Nel cuore della città" },
  sud: { en: "South of the centre", it: "A sud del centro" },
  nord: { en: "North of the centre", it: "A nord del centro" },
  ganzirri: { en: "Along the water in Ganzirri", it: "Lungo l'acqua a Ganzirri" },
  "torre-faro": { en: "At the edge of the Strait", it: "Sul bordo dello Stretto" },
  colli: { en: "Above the city in the hills", it: "Sopra la città, tra i colli" },
};

export default function MessinaGuide({ language }: { language: Language }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeArea = messinaAreas[activeIndex];
  const activePhoto = messinaAreaPhotos[activeArea.id];
  const t = (key: TranslationKey) => translate(language, key);

  return (
    <section className="messina-home-section" aria-labelledby="messina-home-title">
      <div className="container">
        <div className="messina-home-topline">
          <span className="messina-home-topline__lead">{t("home.messinaEyebrow")}</span>
          <span>38°11′ N / 15°33′ E</span>
        </div>

        <div className="messina-home-heading">
          <div className="messina-home-heading__title">
            <span className="messina-home-heading__index" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")} / {String(messinaAreas.length).padStart(2, "0")}
            </span>
            <h2 id="messina-home-title">{t("home.messinaTitle")}</h2>
          </div>
          <div className="messina-home-heading__aside">
            <p>{t("home.messinaIntro")}</p>
            <span aria-hidden="true" />
          </div>
        </div>

        <div className="messina-home-explorer">
          <nav className="messina-home-areas" aria-label={t("home.messinaAreas")}>
            <div className="messina-home-areas__meta" aria-hidden="true">
              <span>{t("home.messinaAreas")}</span>
              <span>01—{String(messinaAreas.length).padStart(2, "0")}</span>
            </div>
            {messinaAreas.map((area, index) => (
              <Link
                href={`/events?city=Messina&area=${area.id}`}
                className="messina-home-area"
                data-active={activeIndex === index ? "true" : undefined}
                key={area.id}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onTouchStart={() => setActiveIndex(index)}
              >
                <span className="messina-home-area__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{area[language]}</strong>
                <Image
                  className="messina-home-area__thumb"
                  src={messinaAreaPhotos[area.id].src}
                  alt=""
                  aria-hidden="true"
                  width={72}
                  height={64}
                />
              </Link>
            ))}
          </nav>

          <figure
            className="messina-home-stage"
            style={{ "--area-pan": `${(activeIndex - 2.5) * 0.75}%` } as CSSProperties}
          >
            <Image
              className="messina-home-stage__photo"
              src={activePhoto.src}
              alt={activePhoto.alt[language]}
              fill
              sizes="(max-width: 700px) 100vw, 56vw"
            />
            <span className="messina-home-stage__credit">{activePhoto.place[language]}</span>
            {activePhoto.source && (
              <span className="messina-home-stage__source">
                <a href={activePhoto.source} target="_blank" rel="noopener noreferrer">
                  {activePhoto.credit ? `Photo: ${activePhoto.credit}` : "Photo: Wikimedia Commons"}
                </a>
                {activePhoto.license && <> · {activePhoto.licenseUrl ? (
                  <a href={activePhoto.licenseUrl} target="_blank" rel="noopener noreferrer">{activePhoto.license}</a>
                ) : activePhoto.license}</>}
              </span>
            )}
            <span className="messina-home-stage__serial" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")} / {String(messinaAreas.length).padStart(2, "0")}
            </span>
            <MessinaGuideVisualizer activeIndex={activeIndex} />
            <figcaption className="messina-home-stage__caption" aria-hidden="true">
              <span>{t("home.messinaLocation")}</span>
              <strong key={activeArea.id}>{activeArea[language]}</strong>
              <small key={`${activeArea.id}-note`}>{areaNotes[activeArea.id][language]}</small>
            </figcaption>
            <div className="messina-home-stage__progress" aria-hidden="true">
              {messinaAreas.map((area, index) => (
                <span key={area.id} data-active={activeIndex === index ? "true" : undefined} />
              ))}
            </div>
          </figure>
        </div>

        <div className="messina-home-links">
          <Link href="/events?city=Messina">
            {t("home.messinaAll")} <FiArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/events?city=Messina&price=free">
            {t("home.messinaFree")} <FiArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/events?city=Messina&category=community">
            {t("home.messinaCommunity")} <FiArrowUpRight aria-hidden="true" />
          </Link>
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
  );
}
