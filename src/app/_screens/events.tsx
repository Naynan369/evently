import Explore from "@/components/Explore";
import ExploreVisualizer from "@/components/ExploreVisualizer";
import { discoveryData } from "@/lib/db";
import { getLanguage } from "@/lib/i18n-server";
import { localizePublicEvents } from "@/lib/google-translation-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "Discover events" };
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const initial = {
    q: read("q"),
    city: read("city"),
    area: read("area"),
    category: read("category"),
    price: read("price"),
  };
  return (
    <main id="main" className="container page-main explore-page">
      <ExploreVisualizer />
      <div className="page-heading">
        <span className="eyebrow">{t("explore.eyebrow")}</span>
        <h1>{t("events.pageTitle")}</h1>
        <p>{t("events.pageIntro")}</p>
      </div>
      <Explore
        key={JSON.stringify(initial)}
        initial={initial}
        events={await localizePublicEvents(
          (await discoveryData()).events,
          language,
        )}
      />
    </main>
  );
}
