"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useCardReveal } from "@/components/useCardReveal";
import type { Category } from "@/lib/types";

const categoryPhotos: Record<Category, string> = {
  music: "/images/music.jpg",
  arts: "/images/festival.jpg",
  food: "/images/culture.jpg",
  technology: "/images/technology.jpg",
  wellness: "/images/outdoors.jpg",
  community: "/images/community.jpg",
};

export default function HomeCategoryCard({
  id,
  name,
  tagline,
  index,
}: {
  id: Category;
  name: string;
  tagline: string;
  index: number;
}) {
  const cardRef = useCardReveal<HTMLAnchorElement>();

  return (
    <Link
      ref={cardRef}
      href={`/events?category=${id}`}
      className="home-category-card"
      style={{ "--reveal-delay": `${(index % 3) * 120}ms` } as CSSProperties}
    >
      <Image
        className="home-category-card__photo"
        src={categoryPhotos[id]}
        alt=""
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
      />
      <span className="home-category-card__icon" aria-hidden="true">
        <CategoryIcon id={id} />
      </span>
      <span className="home-category-card__copy">
        <strong>{name}</strong>
        <span>{tagline}</span>
      </span>
      <FiArrowUpRight className="home-category-card__arrow" aria-hidden="true" />
    </Link>
  );
}
