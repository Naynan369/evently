"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import { messinaAreas, type MessinaArea } from "@/lib/messina";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";

// Simple architectural sketches keep each area distinct without treating the
// shared waterfront photograph as a picture of every neighborhood.
const areaSketches: Record<MessinaArea, string[]> = {
  centro: [
    "M54 366H546",
    "M92 366V222H157V183H224V366M245 366V153H361V366M381 366V238H449V207H509V366",
    "M265 153C265 111 341 111 341 153M303 116V75M281 94H325",
    "M119 260V333M183 218V333M280 207V333M326 207V333M410 267V333M474 244V333",
  ],
  sud: [
    "M52 220C154 207 232 214 335 209C415 205 479 211 548 198",
    "M65 318C163 282 230 348 332 311C417 279 480 334 545 305",
    "M60 365C166 328 238 393 337 356C422 326 487 376 547 346",
    "M197 256L279 174L361 256M227 255V318M331 255V312",
  ],
  nord: [
    "M53 319C129 297 164 223 235 229C303 235 341 152 414 169C462 180 501 217 548 211",
    "M56 357C135 338 183 274 251 281C328 288 373 226 436 234C481 239 514 263 548 259",
    "M77 391C162 373 201 340 273 340C352 341 404 296 482 305C510 307 530 319 548 315",
  ],
  ganzirri: [
    "M57 304C148 255 242 248 323 267C409 287 474 278 543 252",
    "M56 340C149 292 239 288 328 307C413 326 477 318 544 294",
    "M64 378C156 335 246 330 334 348C418 367 480 358 535 337",
    "M119 291C111 247 115 214 132 181M137 282C153 239 155 201 149 162M476 288C489 245 493 216 484 178",
  ],
  "torre-faro": [
    "M237 376H365M258 376L269 177H333L344 376M260 177H342M283 176V116H319V176M276 116H326",
    "M301 114V76M344 154L520 103M342 179L537 188M257 154L93 104",
    "M60 386C166 359 217 391 301 377C400 359 453 388 543 365",
  ],
  colli: [
    "M48 363L177 185L259 290L355 126L552 363",
    "M86 375L178 250L248 338M282 330L355 201L481 376",
    "M51 404C144 376 231 395 314 381C405 366 476 391 549 374",
    "M356 126L378 166M177 185L201 219",
  ],
};

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
              >
                <span className="messina-home-area__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{area[language]}</strong>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </nav>

          <figure className="messina-home-stage">
            <Image
              className="messina-home-stage__photo messina-home-stage__photo--day"
              src="/images/messina-day.jpg"
              alt={t("home.messinaPhotoAlt")}
              fill
              sizes="(max-width: 700px) 100vw, 56vw"
            />
            <Image
              className="messina-home-stage__photo messina-home-stage__photo--night"
              src="/images/messina-night.jpg"
              alt={t("home.messinaPhotoAlt")}
              fill
              sizes="(max-width: 700px) 100vw, 56vw"
            />
            <a
              className="messina-home-stage__credit messina-home-stage__credit--day"
              href="https://commons.wikimedia.org/wiki/File:Messina_-_Panorama_dal_mare.jpg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lucamato · CC BY-SA 4.0
            </a>
            <a
              className="messina-home-stage__credit messina-home-stage__credit--night"
              href="https://unsplash.com/photos/city-skyline-during-night-time-EpQBnTJoOqY"
              target="_blank"
              rel="noopener noreferrer"
            >
              Giuseppe Famiani · Unsplash
            </a>
            <span className="messina-home-stage__serial" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")} / {String(messinaAreas.length).padStart(2, "0")}
            </span>
            <svg
              className="messina-home-stage__sketch"
              key={activeArea.id}
              viewBox="0 0 600 460"
              fill="none"
              aria-hidden="true"
            >
              {areaSketches[activeArea.id].map((path, index) => (
                <path
                  key={path}
                  d={path}
                  style={{ animationDelay: `${index * 110}ms` }}
                />
              ))}
            </svg>
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
