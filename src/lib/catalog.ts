import type { Category, Event } from "./types.ts";
export const categories: {
  id: Category;
  name: string;
  label: string;
  color: string;
}[] = [
  { id: "music", name: "Music", label: "Feel every beat", color: "lilac" },
  {
    id: "arts",
    name: "Arts & culture",
    label: "A fresh perspective",
    color: "pink",
  },
  {
    id: "food",
    name: "Food & drink",
    label: "Good taste, good company",
    color: "peach",
  },
  {
    id: "technology",
    name: "Tech & ideas",
    label: "Meet your next idea",
    color: "blue",
  },
  {
    id: "wellness",
    name: "Outdoors & wellness",
    label: "Room to breathe",
    color: "green",
  },
  {
    id: "community",
    name: "Community",
    label: "Find your people",
    color: "yellow",
  },
];
export const imageOptions = [
  { id: "festival", name: "Festival lights" },
  { id: "music", name: "Live music" },
  { id: "culture", name: "Celebration" },
  { id: "technology", name: "Conference" },
  { id: "outdoors", name: "Outdoors" },
  { id: "community", name: "Together" },
];
export function seedEvents(now = new Date()): Event[] {
  const date = (days: number, hour: number) => {
    const value = new Date(now);
    value.setUTCDate(value.getUTCDate() + days);
    value.setUTCHours(hour, 0, 0, 0);
    return value.toISOString();
  };
  const base = {
    ownerId: null,
    timezone: "Europe/London",
    currency: "gbp",
    capacity: 240,
    available: 240,
    sample: true,
  };
  return [
    {
      ...base,
      id: "sample-1",
      slug: "afterglow-rooftop-sessions",
      title: "Afterglow: rooftop sessions",
      category: "music",
      city: "London",
      venue: "The Skyline Terrace",
      address: "London, United Kingdom",
      startsAt: date(8, 17),
      endsAt: date(8, 22),
      price: 3500,
      image: "music",
      host: "Afterglow Collective",
      genres: ["Electronic", "House"],
      description:
        "Golden-hour skies. A soundtrack worth staying out for. Join an intimate evening of live electronic music and discovery, high above the city.\n\nExpect warm-up sets, a headline performance and plenty of space to meet your next favorite people. Arrive early for the sunset.\n\nDoors open 30 minutes before the first set. This is an illustrative sample event, not a real event listing.",
    },
    {
      ...base,
      id: "sample-2",
      slug: "the-long-table",
      title: "The long table: a supper club",
      category: "food",
      city: "London",
      venue: "Studio & Table",
      address: "London, United Kingdom",
      startsAt: date(12, 18),
      endsAt: date(12, 21),
      price: 6500,
      image: "culture",
      host: "The Good Company",
      description:
        "An evening built around seasonal food and unhurried conversation. Discover a four-course menu designed for sharing, with a seat at the table for everyone.\n\nVegetarian options are available. This is an illustrative sample event.",
    },
    {
      ...base,
      id: "sample-3",
      slug: "ideas-worth-sharing",
      title: "Ideas worth sharing",
      category: "technology",
      city: "Manchester",
      venue: "The Assembly Room",
      address: "Manchester, United Kingdom",
      startsAt: date(15, 9),
      endsAt: date(15, 17),
      price: 2900,
      image: "technology",
      host: "Tomorrow, Together",
      description:
        "A day for curious minds and people making things happen. Meet independent builders, hear thoughtful talks and leave with a notebook full of possibilities.\n\nYour day includes short talks, a hands-on session and time to connect. This is an illustrative sample event.",
    },
    {
      ...base,
      id: "sample-4",
      slug: "a-little-offline",
      title: "A little offline: a morning outside",
      category: "wellness",
      city: "Bristol",
      venue: "The Green Loop",
      address: "Bristol, United Kingdom",
      startsAt: date(6, 8),
      endsAt: date(6, 11),
      price: 0,
      image: "outdoors",
      host: "Slow Sunday Club",
      description:
        "Trade your notifications for fresh air. An easy-paced morning walk, a gentle stretch and a chance to reconnect with the world around you.\n\nAll experience levels welcome. Bring comfortable shoes, water and a layer for the weather. This is an illustrative sample event.",
    },
    {
      ...base,
      id: "sample-5",
      slug: "meet-your-neighborhood",
      title: "Coffee, conversation & new connections",
      category: "community",
      city: "London",
      venue: "The Common Room",
      address: "London, United Kingdom",
      startsAt: date(5, 10),
      endsAt: date(5, 12),
      price: 0,
      image: "community",
      host: "Nice to Meet You",
      description:
        "New to the neighborhood, or just ready to meet someone new? Pull up a chair for a relaxed morning of conversation and shared interests.\n\nCome solo or bring a friend. Everyone is welcome. This is an illustrative sample event.",
    },
    {
      ...base,
      id: "sample-6",
      slug: "color-after-hours",
      title: "Color after hours",
      category: "arts",
      city: "Brighton",
      venue: "Open House Gallery",
      address: "Brighton, United Kingdom",
      startsAt: date(19, 17),
      endsAt: date(19, 21),
      price: 1800,
      image: "festival",
      host: "Open House",
      description:
        "Art, sound and a little unexpected magic. Explore an evening exhibition, meet the artists behind the work and try a creative workshop of your own.\n\nNo creative experience needed, just curiosity. This is an illustrative sample event.",
    },
  ] as Event[];
}
export function categoryName(id: string) {
  return categories.find((c) => c.id === id)?.name ?? id;
}
