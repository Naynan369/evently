"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { IconType } from "react-icons";
import {
  FiArrowUpRight,
  FiArrowRight,
  FiChevronDown,
  FiCompass,
  FiGrid,
  FiStar,
  FiMusic,
  FiBookmark,
  FiCalendar,
  FiBriefcase,
  FiMapPin,
  FiUsers,
  FiUser,
  FiHelpCircle,
  FiBarChart2,
  FiTrendingUp,
  FiMenu,
  FiX,
  FiMoon,
  FiSun,
  FiGlobe,
} from "react-icons/fi";
import { Brand } from "./Brand";
import { useApp } from "./AppProvider";
import AccountActions from "./AccountActions";
import type { Language, TranslationKey } from "@/lib/i18n";

type NavigationItem = {
  href: string;
  label: TranslationKey;
  description: TranslationKey;
  icon: IconType;
};
const discovery: NavigationItem[] = [
  {
    href: "/events",
    label: "nav.discovery.events",
    description: "nav.discovery.eventsDescription",
    icon: FiCompass,
  },
  {
    href: "/categories",
    label: "nav.discovery.categories",
    description: "nav.discovery.categoriesDescription",
    icon: FiGrid,
  },
];
const recommendations: NavigationItem = {
  href: "/for-you",
  label: "nav.discovery.recommendations",
  description: "nav.discovery.recommendationsDescription",
  icon: FiStar,
};
const attendeeAccount: NavigationItem[] = [
  {
    href: "/account",
    label: "nav.personal.account",
    description: "nav.personal.accountDescription",
    icon: FiUser,
  },
  {
    href: "/intent",
    label: "nav.personal.intent",
    description: "nav.personal.intentDescription",
    icon: FiStar,
  },
  {
    href: "/tickets",
    label: "nav.personal.tickets",
    description: "nav.personal.ticketsDescription",
    icon: FiCalendar,
  },
  {
    href: "/saved",
    label: "nav.personal.saved",
    description: "nav.personal.savedDescription",
    icon: FiBookmark,
  },
  {
    href: "/music",
    label: "nav.discovery.music",
    description: "nav.discovery.musicDescription",
    icon: FiMusic,
  },
];
const organizerAccount: NavigationItem[] = [
  {
    href: "/organizer",
    label: "nav.organize.dashboard",
    description: "nav.organize.dashboardDescription",
    icon: FiBriefcase,
  },
  {
    href: "/organizer/demand",
    label: "nav.organize.demand",
    description: "nav.organize.demandDescription",
    icon: FiTrendingUp,
  },
  {
    href: "/create-event",
    label: "nav.organize.create",
    description: "nav.organize.createDescription",
    icon: FiCalendar,
  },
  {
    href: "/venues",
    label: "organizer.venuePortfolio",
    description: "nav.organize.venuesDescription",
    icon: FiMapPin,
  },
  {
    href: "/business-profiles",
    label: "organizer.shell.profiles",
    description: "nav.organize.profilesDescription",
    icon: FiUsers,
  },
];
const organize: NavigationItem[] = [
  {
    href: "/organizer",
    label: "nav.organize.dashboard",
    description: "nav.organize.dashboardDescription",
    icon: FiBarChart2,
  },
];
function activePath(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}
function MenuLink({
  item,
  path,
  onNavigate,
}: {
  item: NavigationItem;
  path: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const { t } = useApp();
  return (
    <Link
      href={item.href}
      className="navigation-item"
      aria-current={activePath(path, item.href) ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="navigation-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="navigation-copy">
        <strong>{t(item.label)}</strong>
        <span>{t(item.description)}</span>
      </span>
      <FiArrowRight className="navigation-arrow" aria-hidden="true" />
    </Link>
  );
}
export default function Navbar() {
  const path = usePathname();
  const { user, language, setLanguage, t } = useApp();
  const attendeeWorkspace = Boolean(user && !user.isOrganizer);
  const accountItems = user?.isOrganizer ? organizerAccount : attendeeAccount;
  const { resolvedTheme, setTheme } = useTheme();
  const [panel, setPanel] = useState<
    "discover" | "account" | "language" | "mobile" | null
  >(null);
  const header = useRef<HTMLElement>(null);
  const discoverButton = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const languageButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const close = () => setPanel(null);
  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    close();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel) {
        (panel === "discover"
          ? discoverButton
          : panel === "account"
            ? accountButton
            : panel === "language"
              ? languageButton
              : mobileButton
        ).current?.focus();
        setPanel(null);
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setPanel(null);
    };
    const onNavigation = () => setPanel(null);
    const breakpoint = window.matchMedia("(max-width: 1050px)");
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onOutside);
    window.addEventListener("popstate", onNavigation);
    breakpoint.addEventListener("change", onNavigation);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("popstate", onNavigation);
      breakpoint.removeEventListener("change", onNavigation);
    };
  }, [panel]);
  return (
    <header
      className="site-header"
      ref={header}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          close();
      }}
    >
      <div className="container header-inner">
        <div className="header-brand" onClick={close}>
          <Brand />
        </div>
        <nav className="desktop-nav" aria-label={t("nav.primary")}>
          <div className="nav-disclosure">
            <button
              ref={discoverButton}
              className={
                "nav-trigger" +
                (activePath(path, "/events") || activePath(path, "/categories")
                  ? " active"
                  : "")
              }
              aria-label={t("nav.exploreAria")}
              aria-expanded={panel === "discover"}
              aria-controls="discovery-nav"
              onClick={() => setPanel(panel === "discover" ? null : "discover")}
            >
              {t("nav.explore")} <FiChevronDown aria-hidden="true" />
            </button>
            {panel === "discover" && (
              <div className="nav-popover discovery-popover" id="discovery-nav">
                <div className="nav-popover-heading">
                  <span className="menu-eyebrow">
                    {t("nav.discoverEvently")}
                  </span>
                  <p>{t("nav.findSomething")}</p>
                </div>
                {discovery.map((item) => (
                  <MenuLink
                    key={item.href}
                    item={item}
                    path={path}
                    onNavigate={close}
                  />
                ))}
              </div>
            )}
          </div>
          <Link
            href="/for-you"
            onClick={close}
            aria-current={activePath(path, "/for-you") ? "page" : undefined}
          >
            {t("nav.forYou")}
          </Link>
          {!user && (
            <Link
              href="/organizer"
              onClick={close}
              aria-current={activePath(path, "/organizer") ? "page" : undefined}
            >
              {t("nav.organizers")}
            </Link>
          )}
        </nav>
        <div className="header-actions">
          <div className="header-utility">
            <div className="nav-disclosure language-disclosure">
              <button
                ref={languageButton}
                type="button"
                className="language-trigger"
                aria-label={t("language.label")}
                aria-expanded={panel === "language"}
                aria-controls="language-menu"
                onClick={() =>
                  setPanel(panel === "language" ? null : "language")
                }
              >
                <FiGlobe aria-hidden="true" />
                <span>
                  {t(
                    language === "en" ? "language.english" : "language.italian",
                  )}
                </span>
                <FiChevronDown aria-hidden="true" />
              </button>
              {panel === "language" && (
                <div
                  className="nav-popover language-popover"
                  id="language-menu"
                  role="group"
                  aria-label={t("language.label")}
                >
                  <span className="menu-eyebrow">{t("language.label")}</span>
                  <button
                    type="button"
                    aria-pressed={language === "en"}
                    onClick={() => selectLanguage("en")}
                  >
                    {t("language.english")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={language === "it"}
                    onClick={() => selectLanguage("it")}
                  >
                    {t("language.italian")}
                  </button>
                </div>
              )}
            </div>
            <button
              className="icon-button theme-toggle"
              aria-label={t("nav.theme")}
              title={t("nav.toggleAppearance")}
              onClick={() => {
                close();
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
              }}
            >
              <FiMoon className="moon" aria-hidden="true" />
              <FiSun className="sun" aria-hidden="true" />
            </button>
            {user ? (
              <div className="nav-disclosure account-disclosure">
                <button
                  ref={accountButton}
                  className="account-trigger"
                  aria-label={t("nav.account")}
                  aria-expanded={panel === "account"}
                  aria-controls="account-nav"
                  onClick={() =>
                    setPanel(panel === "account" ? null : "account")
                  }
                >
                  <span className="account-avatar" aria-hidden="true">
                    {user.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="account-trigger-label">
                    {t("nav.account")}
                  </span>
                  <FiChevronDown aria-hidden="true" />
                </button>
                {panel === "account" && (
                  <nav
                    className="nav-popover account-popover"
                    id="account-nav"
                    aria-label={t("nav.accountNavigation")}
                  >
                    <div className="nav-popover-heading">
                      <span className="menu-eyebrow">
                        {t("nav.yourEvently")}
                      </span>
                      <strong className="account-menu-name">{user.name}</strong>
                    </div>
                    {accountItems.map((item) => (
                      <MenuLink
                        key={item.href}
                        item={item}
                        path={path}
                        onNavigate={close}
                      />
                    ))}
                    <div className="account-menu-bottom">
                      <Link href="/help" onClick={close}>
                        <FiHelpCircle aria-hidden="true" /> {t("nav.help")}
                      </Link>
                      <AccountActions compact onSignOut={close} />
                    </div>
                  </nav>
                )}
              </div>
            ) : (
              <Link href="/login" className="account-link" onClick={close}>
                {t("nav.signIn")}
              </Link>
            )}
          </div>
          {!attendeeWorkspace && (
            <Link
              href="/create-event"
              className="button button-dark header-create"
              aria-current={
                activePath(path, "/create-event") ? "page" : undefined
              }
              onClick={close}
            >
              {t("nav.createEvent")}
              <FiArrowUpRight aria-hidden="true" />
            </Link>
          )}
          <button
            ref={mobileButton}
            className="icon-button menu-button"
            aria-label={panel === "mobile" ? t("nav.close") : t("nav.open")}
            aria-expanded={panel === "mobile"}
            aria-controls="mobile-nav"
            onClick={() => setPanel(panel === "mobile" ? null : "mobile")}
          >
            {panel === "mobile" ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>
      {panel === "mobile" && (
        <nav
          id="mobile-nav"
          aria-label={t("nav.primary")}
          className="mobile-nav"
        >
          <div className="container mobile-nav-inner">
            <div className="mobile-nav-groups">
              {[
                {
                  label: t("nav.discover"),
                  items: [...discovery, recommendations],
                },
                ...(user
                  ? [{ label: t("nav.yourAccount"), items: accountItems }]
                  : []),
                ...(!user
                  ? [{ label: t("nav.organize"), items: organize }]
                  : []),
              ].map((group) => (
                <section
                  key={group.label}
                  className="mobile-nav-group"
                  aria-label={group.label}
                >
                  <h2>{group.label}</h2>
                  {group.items.map((item) => (
                    <MenuLink
                      key={item.href}
                      item={item}
                      path={path}
                      onNavigate={close}
                    />
                  ))}
                </section>
              ))}
            </div>
            <div className="mobile-menu-footer">
              <Link href="/help" onClick={close}>
                <FiHelpCircle aria-hidden="true" />
                {t("nav.help")}
              </Link>
              <Link href="/about" onClick={close}>
                {t("nav.about")} <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
            {user && (
              <div className="mobile-account-actions">
                <AccountActions compact onSignOut={close} />
              </div>
            )}
            <section
              className="mobile-language"
              aria-label={t("language.label")}
            >
              <div className="mobile-language-heading">
                <FiGlobe aria-hidden="true" />
                <span className="menu-eyebrow">{t("language.label")}</span>
              </div>
              <div
                className="mobile-language-options"
                role="group"
                aria-label={t("language.label")}
              >
                <button
                  type="button"
                  aria-pressed={language === "en"}
                  onClick={() => selectLanguage("en")}
                >
                  {t("language.english")}
                </button>
                <button
                  type="button"
                  aria-pressed={language === "it"}
                  onClick={() => selectLanguage("it")}
                >
                  {t("language.italian")}
                </button>
              </div>
            </section>
            {!attendeeWorkspace && (
              <Link
                href="/create-event"
                className="button button-dark button-wide mobile-menu-join"
                onClick={close}
              >
                {t("nav.createEvent")}
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
