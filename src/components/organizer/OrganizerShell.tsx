"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiCalendar,
  FiCheckCircle,
  FiGlobe,
  FiGrid,
  FiMapPin,
  FiMenu,
  FiMoon,
  FiPlus,
  FiSun,
  FiUsers,
  FiX,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { useApp } from "@/components/AppProvider";
import { Brand } from "@/components/Brand";
import type { TranslationKey } from "@/lib/i18n";
import styles from "./OrganizerShell.module.css";

type WorkspaceLink = { href: string; label: TranslationKey; icon: IconType };

const workLinks: WorkspaceLink[] = [
  { href: "/organizer", label: "organizer.shell.overview", icon: FiGrid },
  { href: "/organizer#org-event-list", label: "organizer.eventPortfolio", icon: FiCalendar },
  { href: "/organizer#org-checkin", label: "organizer.checkin", icon: FiCheckCircle },
  { href: "/venues", label: "organizer.venuePortfolio", icon: FiMapPin },
  { href: "/business-profiles", label: "organizer.shell.profiles", icon: FiUsers },
];

const titles: Record<string, TranslationKey> = {
  "/organizer": "organizer.shell.overview",
  "/create-event": "nav.createEvent",
  "/venues": "organizer.venuePortfolio",
  "/business-profiles": "organizer.shell.profiles",
  "/event-preview": "organizer.shell.eventPreview",
  "/venue-preview": "organizer.shell.venuePreview",
};

export default function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, language, setLanguage, t } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen, closeMenu]);

  const title = t(titles[pathname] ?? "organizer.shell.overview");
  const initials = user?.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "E";

  return (
    <div className={styles.workspace}>
      {menuOpen && (
        <button
          className={styles.backdrop}
          type="button"
          aria-label={t("nav.close")}
          onClick={closeMenu}
        />
      )}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} id="organizer-navigation">
        <div className={styles.identity}>
          <Brand light />
          <span className={styles.productLabel}>{t("organizer.shell.product")}</span>
          <button
            className={styles.mobileClose}
            type="button"
            aria-label={t("nav.close")}
            onClick={closeMenu}
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <Link className={styles.createLink} href="/create-event" onClick={() => setMenuOpen(false)}>
          <FiPlus aria-hidden="true" />
          <span>{t("nav.createEvent")}</span>
          <FiArrowUpRight aria-hidden="true" />
        </Link>

        <nav className={styles.navigation} aria-label={t("organizer.tools")}>
          <span className={styles.groupLabel}>{t("organizer.workspace")}</span>
          {workLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href && !href.includes("#");
            return (
              <Link
                className={`${styles.navigationLink} ${active ? styles.activeLink : ""}`}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon aria-hidden="true" />
                <span>{t(label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <span className={styles.groupLabel}>{t("organizer.shell.otherView")}</span>
          <Link className={styles.switchLink} href="/account" onClick={() => setMenuOpen(false)}>
            <FiArrowLeft aria-hidden="true" /> {t("organizer.shell.attendeeView")}
          </Link>
          <div className={styles.userCard}>
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
            <span className={styles.userDetails}>
              <strong>{user?.name ?? "Evently"}</strong>
              <small>{user?.email ?? ""}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button
              className={styles.menuButton}
              ref={menuButton}
              type="button"
              aria-label={menuOpen ? t("nav.close") : t("nav.open")}
              aria-expanded={menuOpen}
              aria-controls="organizer-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <FiMenu aria-hidden="true" />
            </button>
            <div className={styles.pageIdentity}>
              <span>{t("organizer.shell.product")}</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.siteLink} href="/events">
              {t("organizer.shell.viewSite")} <FiArrowUpRight aria-hidden="true" />
            </Link>
            <label className={styles.languageControl}>
              <FiGlobe aria-hidden="true" />
              <span className={styles.srOnly}>{t("language.label")}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "it")}
              >
                <option value="en">EN</option>
                <option value="it">IT</option>
              </select>
            </label>
            <button
              className={styles.themeButton}
              type="button"
              aria-label={t("nav.theme")}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
            </button>
          </div>
        </header>
        <div className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}
