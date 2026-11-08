import Link from "next/link";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "About Evently" };
export default async function About() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("page.aboutEyebrow")}</span>
        <h1>{t("page.aboutTitle")}</h1>
      </div>
      <div className="about-hero">
        <div className="about-copy">
          <h2>{t("page.aboutSubhead")}</h2>
          <p>{t("page.aboutOne")}</p>
          <p>{t("page.aboutTwo")}</p>
          <p>{t("page.aboutThree")}</p>
          <Link
            href="/events"
            className="button button-primary"
            style={{ marginTop: 25 }}
          >
            {t("page.aboutCta")} <FiArrowRight />
          </Link>
        </div>
        <div className="about-photo">
          <Image
            src="/images/community.jpg"
            alt={t("page.aboutSubhead")}
            fill
            sizes="(max-width: 760px) 90vw, 45vw"
          />
        </div>
      </div>
      <div className="notice section-spacer">
        <strong>{t("page.sampleTitle")}</strong> {t("page.sampleBody")}
      </div>
    </main>
  );
}
