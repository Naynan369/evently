import MusicConnections from "@/components/MusicConnections";
import { currentUser } from "@/lib/auth";
import { musicStatus } from "@/lib/music-api";
export const metadata = { title: "Your music, live" };
export default async function MusicPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const user = await currentUser();
  const { connection } = await searchParams;
  return (
    <main id="main" className="container page-main">
      <div className="page-heading music-heading">
        <span className="eyebrow">
          FROM YOUR PLAYLIST. TO YOUR NEXT NIGHT OUT.
        </span>
        <h1>
          Your music.
          <br />
          <em>More alive.</em>
        </h1>
        <p>
          The artists you return to. The sounds you love. Find the live
          experiences that feel like you.
        </p>
      </div>
      <MusicConnections
        initial={musicStatus(user?.id)}
        connectionResult={connection}
      />
    </main>
  );
}
