"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  FiArrowUpRight,
  FiArrowRight,
  FiPause,
  FiPlay,
  FiVolumeX,
} from "react-icons/fi";
import { SearchForm } from "./SearchForm";
const collection = [
  {
    label: "Live nights",
    title: "Feel every beat.",
    description: "The crowd. The lights. That one unforgettable chorus.",
    video: "live-nights",
    poster: "music",
    href: "/events?category=music",
  },
  {
    label: "Good company",
    title: "Find your people.",
    description: "Shared tables, new faces and stories that stay with you.",
    video: "good-company",
    poster: "culture",
    href: "/events?category=food",
  },
  {
    label: "Open horizons",
    title: "Make room for more.",
    description: "Fresh air, fresh ideas. A little outside your everyday.",
    video: "open-horizons",
    poster: "outdoors",
    href: "/events?category=wellness",
  },
];
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function reducedSnapshot() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    )
  );
}
export default function EventCinema() {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(true),
    [override, setOverride] = useState(false),
    [failed, setFailed] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    reducedSnapshot,
    () => true,
  );
  const video = useRef<HTMLVideoElement | null>(null),
    slide = collection[index];
  const active = playing && (!reduced || override) && !failed;
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const update = () => {
      if (active && !document.hidden)
        void player.play().catch(() => setPlaying(false));
      else player.pause();
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      player.pause();
    };
  }, [active, index]);
  function select(value: number) {
    setIndex(value);
    setFailed(false);
  }
  return (
    <section className="event-cinema" aria-label="Event collection">
      <div
        className="cinema-media"
        style={{ backgroundImage: "url(/images/" + slide.poster + ".jpg)" }}
      >
        {!failed && (
          <video
            ref={video}
            key={slide.video}
            src={"/videos/" + slide.video + ".mp4"}
            poster={"/images/" + slide.poster + ".jpg"}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => {
              if (active) select((index + 1) % collection.length);
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="cinema-shade" />
      <div className="container cinema-content">
        <div className="cinema-eyebrow">
          <span className="live-dot" /> GO OUT. FEEL SOMETHING.
        </div>
        <h1>
          Life happens.
          <br />
          <em>Be there.</em>
        </h1>
        <p className="cinema-intro">
          The music that moves you. The people you haven’t met.
          <br className="desktop-break" /> A whole collection of reasons to go.
        </p>
        <div className="cinema-ctas">
          <Link className="button button-primary" href="/events">
            Find your next moment <FiArrowUpRight />
          </Link>
          <Link className="cinema-music-link" href="/music">
            Bring your music taste <FiArrowRight />
          </Link>
        </div>
        <div className="cinema-bottom">
          <div className="collection-label">
            <span>THE EVENTLY COLLECTION / 0{index + 1}</span>
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>
          </div>
          <div className="cinema-controls">
            <span className="muted-video">
              <FiVolumeX /> A silent collection
            </span>
            <button
              className="cinema-play"
              aria-label={
                active ? "Pause event slideshow" : "Play event slideshow"
              }
              onClick={() => {
                setOverride(true);
                setPlaying(!active);
              }}
              disabled={failed}
            >
              {active ? <FiPause /> : <FiPlay />}
            </button>
          </div>
        </div>
        <div
          className="collection-tabs"
          role="group"
          aria-label="Choose an event collection"
        >
          {collection.map((item, i) => (
            <button
              key={item.label}
              onClick={() => select(i)}
              aria-pressed={i === index}
            >
              <span>0{i + 1}</span>
              {item.label}
              <span
                className={
                  active && i === index
                    ? "collection-progress animating"
                    : "collection-progress"
                }
              />
            </button>
          ))}
        </div>
      </div>
      <div className="container cinema-search">
        <SearchForm />
        <div className="popular-searches">
          <span>Your kind of out there:</span>
          <Link href="/events?category=music">Live music</Link>
          <Link href="/events?price=free">Free things to do</Link>
          <Link href="/for-you">Picked for you ↗</Link>
        </div>
      </div>
    </section>
  );
}
