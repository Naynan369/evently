import Link from "next/link";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export default async function NotFound() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <main id="main" className="container section page-main">
      <div className="empty-state">
        <span className="eyebrow">{t("page.notFoundEyebrow")}</span>
        <h1 style={{ marginTop: 15 }}>{t("page.notFoundTitle")}</h1>
        <p>{t("page.notFoundBody")}</p>
        <Link href="/events" className="button button-primary">
          {t("page.discoverEvents")}
        </Link>
      </div>
    </main>
  );
}
