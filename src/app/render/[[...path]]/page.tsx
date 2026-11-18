import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import type { ScreenPath } from "@/app/_screens/paths";

type RouteProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ScreenProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: RouteProps["searchParams"];
};

type ScreenModule = {
  default: ComponentType<ScreenProps>;
  metadata?: Metadata;
  generateMetadata?: (props: {
    params: Promise<{ slug: string }>;
  }) => Promise<Metadata>;
};

// Keep page implementations together. Only this route file needs Next.js's
// folder convention; the keys below are the public URL paths.
const screens = {
  "": () => import("@/app/_screens/home"),
  about: () => import("@/app/_screens/about"),
  account: () => import("@/app/_screens/account"),
  admin: () => import("@/app/_screens/admin"),
  "business-profiles": () => import("@/app/_screens/business-profiles"),
  categories: () => import("@/app/_screens/categories"),
  "create-event": () => import("@/app/_screens/create-event"),
  "event-preview": () => import("@/app/_screens/event-preview"),
  events: () => import("@/app/_screens/events"),
  "for-you": () => import("@/app/_screens/for-you"),
  "forgot-password": () => import("@/app/_screens/forgot-password"),
  help: () => import("@/app/_screens/help"),
  intent: () => import("@/app/_screens/intent"),
  login: () => import("@/app/_screens/login"),
  music: () => import("@/app/_screens/music"),
  "music/privacy": () => import("@/app/_screens/music-privacy"),
  organizer: () => import("@/app/_screens/organizer"),
  "organizer/demand": () => import("@/app/_screens/organizer-demand"),
  policies: () => import("@/app/_screens/policies"),
  register: () => import("@/app/_screens/register"),
  report: () => import("@/app/_screens/report"),
  "reset-password": () => import("@/app/_screens/reset-password"),
  saved: () => import("@/app/_screens/saved"),
  tickets: () => import("@/app/_screens/tickets"),
  "venue-preview": () => import("@/app/_screens/venue-preview"),
  venues: () => import("@/app/_screens/venues"),
  "verify-email": () => import("@/app/_screens/verify-email"),
} as const satisfies Record<ScreenPath, () => Promise<unknown>>;

async function screenFor(segments: string[]) {
  if (segments.length === 2 && segments[0] === "events") {
    return {
      screen: (await import("@/app/_screens/event-detail")) as unknown as ScreenModule,
      identifier: segments[1],
    };
  }
  if (segments.length === 2 && segments[0] === "tickets") {
    return {
      screen: (await import("@/app/_screens/ticket-detail")) as unknown as ScreenModule,
      identifier: segments[1],
    };
  }
  const path = segments.join("/");
  if (!Object.prototype.hasOwnProperty.call(screens, path)) return null;
  const load = screens[path as keyof typeof screens];
  return {
    screen: (await load()) as unknown as ScreenModule,
    identifier: "",
  };
}

export async function generateMetadata({
  params,
}: Pick<RouteProps, "params">): Promise<Metadata> {
  const match = await screenFor((await params).path ?? []);
  if (!match) notFound();
  if (match.screen.generateMetadata) {
    return match.screen.generateMetadata({
      params: Promise.resolve({ slug: match.identifier }),
    });
  }
  return match.screen.metadata ?? {};
}

export default async function Page({ params, searchParams }: RouteProps) {
  const match = await screenFor((await params).path ?? []);
  if (!match) notFound();
  const Screen = match.screen.default;
  return (
    <Screen
      params={Promise.resolve({
        slug: match.identifier,
        id: match.identifier,
      })}
      searchParams={searchParams}
    />
  );
}
