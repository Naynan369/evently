"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  FiBell,
  FiCalendar,
  FiCreditCard,
  FiGlobe,
  FiGrid,
  FiMoon,
  FiSettings,
  FiShield,
  FiSun,
  FiTag,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useApp } from "@/components/AppProvider";
import AccountActions from "@/components/AccountActions";
import { adminViewFromParam, type AdminView } from "./adminViews";
import styles from "./AdminShell.module.css";

const navigation = [
  { view: "overview", en: "Overview", it: "Panoramica", icon: FiGrid },
  { view: "events", en: "Events", it: "Eventi", icon: FiCalendar },
  { view: "organizers", en: "Organizers", it: "Organizzatori", icon: FiUsers },
  { view: "users", en: "Accounts", it: "Account", icon: FiUsers },
  { view: "crm", en: "CRM", it: "CRM", icon: FiUserCheck },
  { view: "tickets", en: "Tickets", it: "Biglietti", icon: FiTag },
  { view: "payments", en: "Payments", it: "Pagamenti", icon: FiCreditCard },
  { view: "moderation", en: "Moderation", it: "Moderazione", icon: FiShield },
  { view: "settings", en: "Settings", it: "Impostazioni", icon: FiSettings },
] as const satisfies ReadonlyArray<{
  view: AdminView;
  en: string;
  it: string;
  icon: typeof FiGrid;
}>;

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, language, setLanguage, t } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const view = adminViewFromParam(useSearchParams().get("view"));
  const current = navigation.find((item) => item.view === view)!;
  const it = language === "it";

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <Link
          className={styles.identity}
          href="/admin"
          aria-label="Evently admin home"
        >
          <span className={styles.mark} aria-hidden="true">
            ✳
          </span>
          <span>
            evently<span className={styles.dot}>.</span>
          </span>
          <span className={styles.adminTag}>ADMIN</span>
        </Link>
        <div className={styles.sidebarRule} />
        <nav
          className={styles.navigation}
          aria-label={it ? "Navigazione amministratore" : "Admin navigation"}
        >
          {navigation.map(({ view: itemView, en, it: italian, icon: Icon }) => (
            <Link
              key={itemView}
              href={
                itemView === "overview" ? "/admin" : `/admin?view=${itemView}`
              }
              className={`${styles.navigationLink} ${view === itemView ? styles.activeLink : ""}`}
              aria-current={view === itemView ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{it ? italian : en}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <span>{it ? "ACCESSO AMMINISTRATORE" : "ADMIN ACCESS"}</span>
          <strong>{user?.name ?? "Evently"}</strong>
          <small>{user?.email ?? ""}</small>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <span>
              {it
                ? "AMMINISTRAZIONE / PIATTAFORMA"
                : "ADMINISTRATION / PLATFORM"}
            </span>
            <strong>{it ? current.it : current.en}</strong>
          </div>
          <div className={styles.topbarActions}>
            <Link
              className={styles.iconLink}
              href="/admin?view=moderation"
              aria-label={it ? "Apri moderazione" : "Open moderation"}
              title={it ? "Moderazione" : "Moderation"}
            >
              <FiBell aria-hidden="true" />
            </Link>
            <label className={styles.languageControl}>
              <FiGlobe aria-hidden="true" />
              <span className={styles.srOnly}>{t("language.label")}</span>
              <select
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as "en" | "it")
                }
              >
                <option value="en">EN</option>
                <option value="it">IT</option>
              </select>
            </label>
            <button
              className={styles.iconButton}
              type="button"
              aria-label={t("nav.theme")}
              title={t("nav.toggleAppearance")}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <FiMoon className={styles.themeMoon} aria-hidden="true" />
              <FiSun className={styles.themeSun} aria-hidden="true" />
            </button>
            <AccountActions compact />
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
