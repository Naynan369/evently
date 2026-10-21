"use client";

import Link from "next/link";
import { useState } from "react";
import { FiArrowUpRight, FiArrowRight, FiPause, FiPlay } from "react-icons/fi";
import { SearchForm } from "./SearchForm";
import MusicVisualizer from "./MusicVisualizer";

const collection = [
  {
    label: "Club nights",
    title: "Lose yourself in the lights.",
    description: "Lights down, bass up. Find your way to the floor.",
  },
  {
    label: "Good company",
    title: "Find your people.",
    description: "Shared tables, new faces and stories that stay with you.",
  },
  {
    label: "Open horizons",
    title: "Make room for more.",
    description: "Fresh air, fresh ideas. A little outside your everyday.",
  },
];

export default function EventCinema() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const slide = collection[index];

  return (
    <section className="event-cinema" aria-label="Event collection">
      <div className="cinema-media">
        <MusicVisualizer mode={index} playing={playing} />
      </div>
      <div className="cinema-shade" />
      <div className="container cinema-content">
        <div className="cinema-eyebrow">
          <span className="live-dot" /> EVENTLY / LIVE EXPERIENCES
        </div>
        <h1>
          Events worth
          <br />
          <em>being there for.</em>
        </h1>
        <p className="cinema-intro">
          Explore live music, culture, food and experiences worth making time
          for.
        </p>
        <div className="cinema-ctas">
          <Link className="button button-primary" href="/events">
            Explore events <FiArrowUpRight />
          </Link>
          <Link className="cinema-music-link" href="/for-you">
            See recommendations <FiArrowRight />
          </Link>
        </div>
        <div className="cinema-bottom">
          <div className="collection-label" aria-live="polite">
            <span>THE EVENTLY COLLECTION / 0{index + 1}</span>
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>
          </div>
          <div className="cinema-controls">
            <span className="visualizer-status">
              <span className="visualizer-status-dot" />
              Generative music visualizer
            </span>
            <button
              className="cinema-play"
              aria-label={
                playing ? "Pause background animation" : "Play background animation"
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
          aria-label="Choose an event collection"
        >
          {collection.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
            >
              <span>0{i + 1}</span>
              {item.label}
              <span className="collection-progress" />
            </button>
          ))}
        </div>
      </div>
      <div className="container cinema-search">
        <SearchForm />
        <div className="popular-searches">
          <span>Popular searches</span>
          <Link href="/events?category=music">Live music</Link>
          <Link href="/events?price=free">Free things to do</Link>
          <Link href="/for-you">Picked for you ↗</Link>
        </div>
      </div>
    </section>
  );
}
