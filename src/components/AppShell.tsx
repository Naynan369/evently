"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { Brand } from "./Brand";
import { useApp } from "./AppProvider";
import Footer from "./Footer";
import Navbar from "./Navbar";
import VerificationNotice from "./VerificationNotice";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useApp();

  if (pathname === "/create-event") {
    return (
      <>
        <header className="create-shell-header">
          <div className="container create-shell-inner">
            <Brand />
            <span className="create-shell-label">{t("nav.createEvent")}</span>
            <Link
              aria-label={t("create.backToStudio")}
              className="create-shell-exit"
              href="/organizer"
            >
              <FiArrowLeft aria-hidden="true" />
              <span>{t("create.backToStudio")}</span>
            </Link>
          </div>
        </header>
        {children}
      </>
    );
  }

  return (
    <>
      <Navbar />
      <VerificationNotice />
      {children}
      <Footer />
    </>
  );
}
