"use client";

import { usePathname } from "next/navigation";
import OrganizerShell from "./organizer/OrganizerShell";
import Footer from "./Footer";
import Navbar from "./Navbar";
import VerificationNotice from "./VerificationNotice";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const organizerRoutes = [
    "/organizer",
    "/create-event",
    "/venues",
    "/business-profiles",
    "/event-preview",
    "/venue-preview",
  ];
  if (organizerRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
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
