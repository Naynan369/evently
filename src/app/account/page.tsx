import Link from "next/link";
import { redirect } from "next/navigation";
import { FiArrowUpRight } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { categoryName } from "@/lib/catalog";
import AccountActions from "@/components/AccountActions";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";
export const metadata = { title: "Your account" };
export default async function Account() {
  const language = await getLanguage();
  const t = (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("account.eyebrow")}</span>
        <h1>{t("account.greeting", { name: user.name.split(" ")[0] })}</h1>
        <p>{t("account.intro")}</p>
      </div>
      <div className="account-grid">
        <div className="panel">
          <h2>{t("account.profile")}</h2>
          <div className="summary-row">
            <span>{t("account.name")}</span>
            <strong>{user.name}</strong>
          </div>
          <div className="summary-row">
            <span>{t("auth.email")}</span>
            <strong style={{ overflowWrap: "anywhere" }}>{user.email}</strong>
          </div>
          <div className="notice">
            <strong>
              {user.emailVerified ? t("account.verified") : t("account.unverified")}
            </strong>
            {!user.emailVerified && (
              <p>
                <Link href="/verify-email">{t("account.verifyEmail")}</Link>
              </p>
            )}
          </div>
          <div className="notice">
            <strong>{t("account.interests")}</strong>
            <br />
            {user.interests.length
              ? user.interests.map((id) => categoryName(id, language)).join(" · ")
              : t("account.noInterests")}
            <br />
            <Link href="/for-you">{t("account.tune")}</Link>
          </div>
          <AccountActions />
        </div>
        <div className="panel">
          <h2>{t("account.next")}</h2>
          <div className="account-links">
            {[
              ["/tickets", "account.tickets"],
              ["/saved", "account.saved"],
              ["/for-you", "account.recommendations"],
              ["/music", "account.music"],
              ["/forgot-password", "account.resetPassword"],
              ["/organizer", "account.organizer"],
              ["/help", "account.help"],
            ].map(([href, key]) => (
              <Link href={href} key={href}>
                {t(key as TranslationKey)}
                <FiArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
