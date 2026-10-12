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
  FiUser,
  FiHelpCircle,
  FiPlusCircle,
  FiBarChart2,
  FiMenu,
  FiX,
  FiMoon,
  FiSun,
} from "react-icons/fi";
import { Brand } from "./Brand";
import { useApp } from "./AppProvider";
import AccountActions from "./AccountActions";

type NavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: IconType;
};
const discovery: NavigationItem[] = [
  {
    href: "/events",
    label: "Explore events",
    description: "Find your next experience",
    icon: FiCompass,
  },
  {
    href: "/categories",
    label: "Browse categories",
    description: "Explore by interest",
    icon: FiGrid,
  },
  {
    href: "/for-you",
    label: "Recommendations",
    description: "Events selected for you",
    icon: FiStar,
  },
  {
    href: "/music",
    label: "Music preferences",
    description: "Manage your music taste",
    icon: FiMusic,
  },
];
const personal: NavigationItem[] = [
  {
    href: "/tickets",
    label: "Tickets & bookings",
    description: "Manage your upcoming plans",
    icon: FiCalendar,
  },
  {
    href: "/saved",
    label: "Saved events",
    description: "Keep your shortlist together",
    icon: FiBookmark,
  },
  {
    href: "/account",
    label: "Account overview",
    description: "Your profile and preferences",
    icon: FiUser,
  },
];
const organize: NavigationItem[] = [
  {
    href: "/create-event",
    label: "Create an event",
    description: "Publish your next experience",
    icon: FiPlusCircle,
  },
  {
    href: "/organizer",
    label: "Organizer dashboard",
    description: "Manage events and attendees",
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
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </span>
      <FiArrowRight className="navigation-arrow" aria-hidden="true" />
    </Link>
  );
}
export default function Navbar() {
  const path = usePathname();
  const { user } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const [panel, setPanel] = useState<"discover" | "account" | "mobile" | null>(
    null,
  );
  const header = useRef<HTMLElement>(null);
  const discoverButton = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const close = () => setPanel(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel) {
        (panel === "discover"
          ? discoverButton
          : panel === "account"
            ? accountButton
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
        <div onClick={close}>
          <Brand />
        </div>
        <nav className="desktop-nav" aria-label="Main navigation">
          <div className="nav-disclosure">
            <button
              ref={discoverButton}
              className={
                "nav-trigger" +
                (activePath(path, "/events") ||
                path === "/categories" ||
                path === "/music"
                  ? " active"
                  : "")
              }
              aria-label="Discover menu"
              aria-expanded={panel === "discover"}
              aria-controls="discovery-nav"
              onClick={() => setPanel(panel === "discover" ? null : "discover")}
            >
              Discover <FiChevronDown aria-hidden="true" />
            </button>
            {panel === "discover" && (
              <div className="nav-popover discovery-popover" id="discovery-nav">
                <div className="nav-popover-heading">
                  <span className="menu-eyebrow">DISCOVER EVENTLY</span>
                  <p>Find something worth going to.</p>
                </div>
                {discovery.map((item) => (
                  <MenuLink
                    key={item.href}
                    item={item}
                    path={path}
                    onNavigate={close}
                  />
                ))}
                <Link
                  className="nav-popover-footer"
                  href="/events"
                  onClick={close}
                >
                  View all events <FiArrowUpRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/for-you"
            onClick={close}
            aria-current={path === "/for-you" ? "page" : undefined}
          >
            Recommendations
          </Link>
          <Link
            href="/organizer"
            onClick={close}
            aria-current={
              path === "/organizer" || path === "/create-event"
                ? "page"
                : undefined
            }
          >
            Organizers
          </Link>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button theme-toggle"
            aria-label="Switch between light and dark theme"
            onClick={() => {
              close();
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
            }}
          >
            <FiMoon className="moon" />
            <FiSun className="sun" />
          </button>
          {user ? (
            <div className="nav-disclosure account-disclosure">
              <button
                ref={accountButton}
                className="account-trigger"
                aria-label="Account menu"
                aria-expanded={panel === "account"}
                aria-controls="account-nav"
                onClick={() => setPanel(panel === "account" ? null : "account")}
              >
                <span className="account-avatar" aria-hidden="true">
                  {user.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="account-trigger-label">My account</span>
                <FiChevronDown aria-hidden="true" />
              </button>
              {panel === "account" && (
                <nav
                  className="nav-popover account-popover"
                  id="account-nav"
                  aria-label="Account navigation"
                >
                  <div className="nav-popover-heading">
                    <span className="menu-eyebrow">YOUR EVENTLY</span>
                    <strong className="account-menu-name">{user.name}</strong>
                  </div>
                  {personal.map((item) => (
                    <MenuLink
                      key={item.href}
                      item={item}
                      path={path}
                      onNavigate={close}
                    />
                  ))}
                  <div className="account-menu-bottom">
                    <Link href="/help" onClick={close}>
                      <FiHelpCircle aria-hidden="true" /> Help center
                    </Link>
                    <AccountActions compact onSignOut={close} />
                  </div>
                </nav>
              )}
            </div>
          ) : (
            <Link href="/login" className="account-link" onClick={close}>
              Sign in
            </Link>
          )}
          <Link
            href={user ? "/create-event" : "/register"}
            className="button button-dark header-create"
            onClick={close}
          >
            {user ? "Create an event" : "Get started"}
            <FiArrowUpRight aria-hidden="true" />
          </Link>
          <button
            ref={mobileButton}
            className="icon-button menu-button"
            aria-label={
              panel === "mobile" ? "Close navigation" : "Open navigation"
            }
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
          aria-label="Mobile navigation"
          className="mobile-nav"
        >
          <div className="container mobile-nav-inner">
            <div className="mobile-menu-heading">
              <span className="menu-eyebrow">EXPLORE EVENTLY</span>
              <p>Your next experience starts here.</p>
            </div>
            <div className="mobile-nav-groups">
              {[
                { label: "Discover", items: discovery },
                { label: "Your account", items: personal },
                { label: "Organize", items: organize },
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
                Help center
              </Link>
              <Link href="/about" onClick={close}>
                About Evently <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
            {!user && (
              <Link
                href="/register"
                className="button button-primary button-wide mobile-menu-join"
                onClick={close}
              >
                Create an account <FiArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
