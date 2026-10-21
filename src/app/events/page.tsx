import Explore from "@/components/Explore";
import ExploreVisualizer from "@/components/ExploreVisualizer";
import { discoveryData } from "@/lib/db";
export const metadata = { title: "Discover events" };
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const initial = {
    q: read("q"),
    city: read("city"),
    category: read("category"),
    price: read("price"),
  };
  return (
    <main id="main" className="container page-main explore-page">
      <ExploreVisualizer />
      <div className="page-heading">
        <span className="eyebrow">LESS ORDINARY. MORE YOU.</span>
        <h1>Find your next good story.</h1>
        <p>
          From big nights to small discoveries. There’s something out there with
          your name on it.
        </p>
      </div>
      <Explore
        key={JSON.stringify(initial)}
        initial={initial}
        events={(await discoveryData()).events}
      />
    </main>
  );
}
