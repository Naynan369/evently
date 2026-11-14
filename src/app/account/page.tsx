import Link from "next/link";
import { redirect } from "next/navigation";
import type { IconType } from "react-icons";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiBookmark,
  FiCalendar,
  FiMusic,
  FiStar,
} from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { loadAttendeeDashboard } from "@/lib/attendee-dashboard";
import { categoryName } from "@/lib/catalog";
import { eventDate } from "@/lib/format";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";
import AccountActions from "@/components/AccountActions";
import styles from "./AccountDashboard.module.css";

export const metadata = { title: "Your account" };

export default async function Account() {
  const language = await getLanguage();
  const t = (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  if (user.isOrganizer) redirect("/organizer");

  const { upcoming, savedCount } = await loadAttendeeDashboard(user.id);

  const features: {
    href: string;
    title: TranslationKey;
    description: TranslationKey;
    icon: IconType;
    count?: number;
  }[] = [
    {
      href: "/tickets",
      title: "account.tickets",
      description: "account.dashboard.ticketsDescription",
      icon: FiCalendar,
      count: upcoming.length,
    },
    {
      href: "/saved",
      title: "account.saved",
      description: "account.dashboard.savedDescription",
      icon: FiBookmark,
      count: savedCount,
    },
    {
      href: "/for-you",
      title: "account.recommendations",
      description: user.interests.length
        ? "account.dashboard.recommendationsReady"
        : "account.dashboard.recommendationsSetup",
      icon: FiStar,
    },
    {
      href: "/music",
      title: "account.music",
      description: "account.dashboard.musicDescription",
      icon: FiMusic,
    },
  ];

  return (
    <main id="main" className={`container page-main ${styles.dashboard}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{t("account.eyebrow")}</span>
          <h1>{t("account.greeting", { name: user.name.split(" ")[0] })}</h1>
          <p>{t("account.intro")}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/events">
              {t("nav.discovery.events")} <FiArrowUpRight aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryAction} href="/for-you">
              {t("account.recommendations")} <FiArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div
          className={styles.heroSummary}
          role="group"
          aria-label={t("account.dashboard.summary")}
        >
          <div>
            <strong>{upcoming.length.toString().padStart(2, "0")}</strong>
            <span>{t("account.dashboard.upcomingCount")}</span>
          </div>
          <div>
            <strong>{savedCount.toString().padStart(2, "0")}</strong>
            <span>{t("account.dashboard.savedCount")}</span>
          </div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="account-tools-title">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIndex}>
            01 / {t("account.dashboard.yourSpace")}
          </span>
          <h2 id="account-tools-title">{t("account.dashboard.plansTitle")}</h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map(({ href, title, description, icon: Icon, count }) => (
            <Link className={styles.featureCard} href={href} key={href}>
              <span className={styles.featureTop}>
                <span className={styles.featureIcon}>
                  <Icon aria-hidden="true" />
                </span>
                {count !== undefined && (
                  <span className={styles.featureCount}>{count}</span>
                )}
              </span>
              <span className={styles.featureText}>
                <strong>{t(title)}</strong>
                <small>{t(description)}</small>
              </span>
              <span className={styles.featureFooter}>
                {t("account.dashboard.open")}{" "}
                <FiArrowUpRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {upcoming[0] && (
        <section
          className={styles.nextBooking}
          aria-labelledby="next-booking-title"
        >
          <div>
            <span className={styles.sectionIndex}>
              02 / {t("account.dashboard.nextUp")}
            </span>
            <h2 id="next-booking-title">{upcoming[0].event.title}</h2>
            <p>
              {eventDate(
                upcoming[0].event.startsAt,
                upcoming[0].event.timezone,
                false,
                language,
              )}
              {" · "}
              {upcoming[0].event.city}
            </p>
          </div>
          <Link
            href={`/tickets/${upcoming[0].id}`}
            className={styles.bookingAction}
          >
            {t("tickets.viewBooking")} <FiArrowUpRight aria-hidden="true" />
          </Link>
        </section>
      )}

      <section className={styles.profile} aria-labelledby="profile-title">
        <span className={styles.sectionIndex}>
          {t("account.dashboard.accountDetails")}
        </span>
        <h2 id="profile-title">{t("account.profile")}</h2>
        <dl>
          <div>
            <dt>{t("account.name")}</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>{t("auth.email")}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t("account.interests")}</dt>
            <dd>
              {user.interests.length
                ? user.interests
                    .map((id) => categoryName(id, language))
                    .join(" · ")
                : t("account.noInterests")}
            </dd>
          </div>
        </dl>
        <div className={styles.profileStatus}>
          <span>
            {user.emailVerified
              ? t("account.verified")
              : t("account.unverified")}
          </span>
          {!user.emailVerified && (
            <Link href="/verify-email">{t("account.verifyEmail")}</Link>
          )}
        </div>
        <div className={styles.profileActions}>
          <Link href="/for-you">{t("account.tune")}</Link>
          <Link href="/forgot-password">{t("account.resetPassword")}</Link>
          <AccountActions />
        </div>
      </section>
    </main>
  );
}
