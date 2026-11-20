import Link from "next/link";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";
export const metadata = { title: "Help & questions" };
export default async function Help() {
  const language = await getLanguage();
  const t = (key: TranslationKey) => translate(language, key);
  const questions = Array.from({ length: 9 }, (_, index) => {
    const number = index + 1;
    return [
      t(`help.q${number}` as TranslationKey),
      t(`help.a${number}` as TranslationKey),
    ];
  });
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("page.helpEyebrow")}</span>
        <h1>{t("page.helpTitle")}</h1>
        <p>{t("page.helpIntro")}</p>
      </div>
      {questions.map(([q, a]) => (
        <details className="faq" key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
      <div className="notice section-spacer">
        {t("page.helpTickets")}{" "}
        <Link href="/tickets">{t("page.helpTicketsLink")}</Link>.{" "}
        {t("page.helpOrganizing")}{" "}
        <Link href="/organizer">{t("page.helpOrganizerLink")}</Link>.
      </div>
      <div className="notice section-spacer">
        {language === "it"
          ? "Quando disponibile, Google Translate traduce alcuni testi dell’interfaccia e le descrizioni degli eventi pubblici. Le traduzioni automatiche possono contenere errori."
          : "When available, Google Translate translates some interface text and public event descriptions into Italian. Automatic translations can contain errors."}{" "}
        <a href="https://translate.google.com/" target="_blank" rel="noopener noreferrer">
          Google Translate
        </a>.
      </div>
    </main>
  );
}
