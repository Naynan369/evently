"use client";

import { useEffect, useRef } from "react";

export function useCardReveal<T extends HTMLElement>(targetSelector?: string) {
  const cardRef = useRef<T>(null);

  useEffect(() => {
    const card = cardRef.current;
    const target = targetSelector
      ? card?.querySelector<HTMLElement>(targetSelector)
      : card;
    if (
      !card ||
      !target ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const finishReveal = (transition: TransitionEvent) => {
      if (transition.target === target && transition.propertyName === "transform") {
        card.classList.remove("is-pending", "is-visible");
      }
    };

    card.classList.add("is-pending");
    target.addEventListener("transitionend", finishReveal);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        card.classList.add("is-visible");
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px 48px 0px" },
    );
    observer.observe(card);

    return () => {
      observer.disconnect();
      target.removeEventListener("transitionend", finishReveal);
      card.classList.remove("is-pending", "is-visible");
    };
  }, [targetSelector]);

  return cardRef;
}
