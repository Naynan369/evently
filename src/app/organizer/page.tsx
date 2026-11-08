import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FiArrowUpRight,
  FiCalendar,
  FiCreditCard,
  FiPlus,
  FiMapPin,
  FiUsers,
} from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import {
  businessProfilesForOwner,
  ensureBusinessProfile,
  organizerData,
} from "@/lib/db";
import OrganizerStudio from "@/components/OrganizerStudio";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { organizerDemoMode } from "@/lib/demo";

export const metadata = { title: "Organizer studio" };

export default async function Organizer() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const demoMode = organizerDemoMode();
  const user = await currentUser();
  if (!user) redirect("/login?next=/organizer");
  if (!user.emailVerified) redirect("/verify-email");

  await ensureBusinessProfile(user, "organizer");
  const [data, profiles] = await Promise.all([
    organizerData(user.id),
    businessProfilesForOwner(user.id, "organizer"),
  ]);

  return (
    <main id="main" className="container page-main organizer-page">
      <header className="org-hero">
        <div className="org-hero-copy">
          <span className="org-kicker"><i aria-hidden="true" /> {t("organizer.kicker")}</span>
          <h1>
            {t("organizer.title")}
            <br />
            <em>{t("organizer.titleEmphasis")}</em>
          </h1>
          <p>{t("organizer.intro")}</p>
          <div className="org-hero-actions">
            <Link href="/create-event" className="button button-primary">
              <FiPlus aria-hidden="true" /> {t("nav.createEvent")}
            </Link>
            <Link href="/events" className="org-browse-link">
              {t("organizer.browse")} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <nav className="org-quick-links" aria-label={t("organizer.tools")}>
          <div className="org-quick-links-heading">
            <span>{t("organizer.workspace")}</span>
            <span>{demoMode ? "01 — 02" : "01 — 04"}</span>
          </div>
          <Link href="#org-event-list">
            <span className="org-quick-icon"><FiCalendar aria-hidden="true" /></span>
            <span><strong>{t("organizer.eventPortfolio")}</strong><small>{t("organizer.eventPortfolioDescription")}</small></span>
            <FiArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="#org-checkin">
            <span className="org-quick-icon"><FiUsers aria-hidden="true" /></span>
            <span><strong>{t("organizer.checkin")}</strong><small>{t("organizer.checkinDescription")}</small></span>
            <FiArrowUpRight aria-hidden="true" />
          </Link>
          {!demoMode && <Link href="#org-payments">
            <span className="org-quick-icon"><FiCreditCard aria-hidden="true" /></span>
            <span><strong>{t("organizer.payments")}</strong><small>{t("organizer.paymentsDescription")}</small></span>
            <FiArrowUpRight aria-hidden="true" />
          </Link>}
          {!demoMode && <Link href="/venues">
            <span className="org-quick-icon"><FiMapPin aria-hidden="true" /></span>
            <span><strong>{t("organizer.venuePortfolio")}</strong><small>{t("organizer.venuePortfolioDescription")}</small></span>
            <FiArrowUpRight aria-hidden="true" />
          </Link>}
        </nav>
      </header>

      <OrganizerStudio
        events={data.events}
        bookings={data.bookings}
        profiles={profiles}
        demoMode={demoMode}
      />
    </main>
  );
}
