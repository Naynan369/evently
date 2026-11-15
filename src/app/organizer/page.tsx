import Link from "next/link";
import { redirect } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import {
  businessProfilesForOwner,
  ensureBusinessProfile,
  organizerData,
} from "@/lib/db";
import OrganizerStudio from "@/components/organizer/OrganizerStudio";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { organizerDemoMode } from "@/lib/demo";
import { platformCheckoutTestEnabled } from "@/lib/platform-checkout-test";
import { isOperator } from "@/lib/operations";

export const metadata = { title: "Organizer studio" };

export default async function Organizer() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const demoMode = organizerDemoMode();
  const user = await currentUser();
  if (!user) redirect("/login?next=/organizer");
  if (!user.emailVerified) redirect("/verify-email");
  if (!user.isOrganizer) redirect("/account");

  await ensureBusinessProfile(user, "organizer");
  const [data, profiles] = await Promise.all([
    organizerData(user.id),
    businessProfilesForOwner(user.id, "organizer"),
  ]);

  return (
    <main id="main" className="container page-main organizer-page">
      <header className="org-dashboard-header">
        <div>
          <span className="org-kicker"><i aria-hidden="true" /> {t("organizer.kicker")}</span>
          <h1>{t("organizer.shell.dashboardTitle")}</h1>
          <p>{t("organizer.intro")}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isOperator(user) && <Link href="/admin" className="button button-outline">{language === "it" ? "Centro operativo" : "Operations desk"}</Link>}
          <Link href="/organizer/demand" className="button button-outline">{language === "it" ? "Interessi della comunità" : "Community demand"}</Link>
          <Link href="/create-event" className="button button-primary"><FiPlus aria-hidden="true" /> {t("nav.createEvent")}</Link>
        </div>
      </header>

      <OrganizerStudio
        events={data.events}
        bookings={data.bookings}
        profiles={profiles}
        demoMode={demoMode}
        platformTestCheckout={platformCheckoutTestEnabled()}
      />
    </main>
  );
}
