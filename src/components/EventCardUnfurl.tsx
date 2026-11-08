"use client";

import type { CSSProperties } from "react";

/** A short lighting pass after the card settles into view. */
export default function EventCardUnfurl({ delay }: { delay: number }) {
  return (
    <span
      aria-hidden="true"
      className="event-card-unfurl"
      style={{ "--sweep-delay": `${delay}ms` } as CSSProperties}
    />
  );
}
