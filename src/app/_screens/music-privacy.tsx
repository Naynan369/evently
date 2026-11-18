import Link from "next/link";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "Your music & privacy" };
export default async function MusicPrivacy() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("musicPrivacy.eyebrow")}</span>
        <h1>
          {t("musicPrivacy.titleOne")}
          <br />
          {t("musicPrivacy.titleTwo")}
        </h1>
        <p>{t("musicPrivacy.intro")}</p>
      </div>
      <div className="panel prose-panel">
        <h2>{t("musicPrivacy.testingTitle")}</h2>
        <p>{t("musicPrivacy.testingBody")}</p>
        <h2>{t("musicPrivacy.shareTitle")}</h2>
        <p>{t("musicPrivacy.shareBody")}</p>
        <h2>{t("musicPrivacy.recommendationsTitle")}</h2>
        <p>{t("musicPrivacy.recommendationsBody")}</p>
        <h2>{t("musicPrivacy.storageTitle")}</h2>
        <p>{t("musicPrivacy.storageBody")}</p>
        <h2>{t("musicPrivacy.detailsTitle")}</h2>
        <p>{t("musicPrivacy.detailsBody")}</p>
        <Link href="/music" className="button button-primary">
          {t("musicPrivacy.manage")} →
        </Link>
      </div>
    </main>
  );
}
