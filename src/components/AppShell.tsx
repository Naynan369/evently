"use client";

import { usePathname } from "next/navigation";
import { isOrganizerRoute } from "@/lib/organizer-routes";
import OrganizerShell from "./organizer/OrganizerShell";
import Footer from "./Footer";
import Navbar from "./Navbar";
import VerificationNotice from "./VerificationNotice";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isOrganizerRoute(pathname)) {
    return <OrganizerShell key={pathname}>{children}</OrganizerShell>;
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
