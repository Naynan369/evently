import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { FiArrowUpRight } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import {
  businessProfilesForOwner,
  ensureBusinessProfile,
  getEvent,
  venuesForOwner,
} from "@/lib/db";
import EventForm from "@/components/EventForm";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { organizerDemoMode } from "@/lib/demo";
import { previewVatPercent } from "@/lib/ticket-preview";
export const metadata = { title: "Create an event" };
export default async function CreateEvent({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const demoMode = organizerDemoMode();
  const user = await currentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent("/create-event" + (edit ? "?edit=" + edit : "")),
    );
  if (!user.emailVerified) redirect("/verify-email");
  const initial = edit ? await getEvent(edit) : undefined;
  if (edit && (!initial || initial.ownerId !== user.id)) notFound();
  await ensureBusinessProfile(user, "organizer");
  const [venues, profiles] = await Promise.all([
    venuesForOwner(user.id),
    businessProfilesForOwner(user.id),
  ]);
  const organizerProfiles = profiles.filter((profile) => profile.kind === "organizer");
  const venueProfiles = profiles.filter((profile) => profile.kind === "venue");
  return (
    <main id="main" className="create-event-page">
      <section className="create-event-hero">
        <div className="container create-event-hero-inner">
          <div className="create-event-hero-copy">
            <span className="eyebrow">{t("create.eyebrow")}</span>
            <h1>{edit ? t("create.editTitle") : t("create.newTitle")}</h1>
            <p>{demoMode
              ? (language === "it" ? "Prepara i dettagli e visualizza l'anteprima prima di condividere l'evento." : "Set up the details and preview your event before sharing it.")
              : edit ? t("create.editIntro") : t("create.newIntro")}</p>
            <div className="create-event-hero-route" aria-label={t("create.workflowLabel")}>
              <span>{t("create.step1")}</span>
              <FiArrowUpRight aria-hidden="true" />
              <span>{t("create.step2")}</span>
              <FiArrowUpRight aria-hidden="true" />
              <span>{t("create.step3")}</span>
              <FiArrowUpRight aria-hidden="true" />
              <span>{t("create.step4")}</span>
            </div>
          </div>
          <div className="create-event-hero-art" aria-hidden="true">
            <Image
              src="/images/community.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 860px) 100vw, 36vw"
            />
            <span className="create-event-hero-art-label">EVENTLY / STUDIO</span>
          </div>
        </div>
      </section>
      <div className="container create-event-workspace">
        <EventForm
          initial={initial || undefined}
          venues={venues}
          organizerProfiles={organizerProfiles}
          venueProfiles={venueProfiles}
          demoMode={demoMode}
          testVatPercent={previewVatPercent()}
        />
      </div>
    </main>
  );
}
