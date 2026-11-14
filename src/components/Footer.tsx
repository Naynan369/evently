"use client";

import Link from "next/link";
import { Brand } from "./Brand";
import { FiArrowUpRight } from "react-icons/fi";
import { useApp } from "./AppProvider";
export default function Footer() {
  const { user, t } = useApp();
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand light />
          <p>
            {t("footer.taglineOne")}
            <br />
            {t("footer.taglineTwo")}
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span>{t("footer.discover")}</span>
            <Link href="/events">{t("nav.discovery.events")}</Link>
            <Link href="/for-you">{t("nav.discovery.recommendations")}</Link>
            <Link href="/categories">{t("nav.discovery.categories")}</Link>
          </div>
          <div>
            <span>{t("footer.account")}</span>
            {user?.isOrganizer ? (
              <>
                <Link href="/organizer">{t("nav.organize.dashboard")}</Link>
                <Link href="/create-event">{t("nav.organize.create")}</Link>
                <Link href="/venues">{t("organizer.venuePortfolio")}</Link>
                <Link href="/business-profiles">{t("organizer.shell.profiles")}</Link>
              </>
            ) : (
              <>
                <Link href="/account">{t("nav.personal.account")}</Link>
                <Link href="/tickets">{t("nav.personal.tickets")}</Link>
                <Link href="/saved">{t("nav.personal.saved")}</Link>
                <Link href="/music">{t("nav.discovery.music")}</Link>
              </>
            )}
          </div>
          {!user && (
            <div>
              <span>{t("footer.organizers")}</span>
              <Link href="/create-event">{t("nav.organize.create")}</Link>
              <Link href="/organizer">{t("nav.organize.dashboard")}</Link>
            </div>
          )}
          <div>
            <span>{t("footer.support")}</span>
            <Link href="/about">
              {t("nav.about")} <FiArrowUpRight />
            </Link>
            <Link href="/help">{t("nav.help")}</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {t("footer.copyright")}
        </span>
        <span>
          {t("footer.madeFor")} <span aria-hidden="true">✳</span>
        </span>
      </div>
    </footer>
  );
}
