import MusicConnections from "@/components/MusicConnections";
import { currentUser } from "@/lib/auth";
import { musicStatus } from "@/lib/music-api";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "Your music, live" };
export default async function MusicPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const user = await currentUser();
  const { connection } = await searchParams;
  return (
    <main id="main" className="container page-main">
      <div className="page-heading music-heading">
        <span className="eyebrow">
          {t("music.eyebrow")}
        </span>
        <h1>
          {t("music.title")}
          <br />
          <em>{t("music.titleEmphasis")}</em>
        </h1>
        <p>{t("music.intro")}</p>
      </div>
      <MusicConnections
        initial={await musicStatus(user?.id)}
        connectionResult={connection}
      />
    </main>
  );
}
