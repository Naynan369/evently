"use client";

import { usePathname } from "next/navigation";
import { isOrganizerRoute } from "@/lib/organizer-routes";
import OrganizerShell from "./organizer/OrganizerShell";
import AdminShell from "./admin/AdminShell";
import Footer from "./Footer";
import Navbar from "./Navbar";
import VerificationNotice from "./VerificationNotice";

export default function AppShell({
  children,
  operator = false,
}: {
  children: React.ReactNode;
  operator?: boolean;
}) {
  const pathname = usePathname();
  if (operator && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return <AdminShell>{children}</AdminShell>;
  }
  if (isOrganizerRoute(pathname)) {
    return <OrganizerShell key={pathname}>{children}</OrganizerShell>;
  }

  return (
    <>
      <Navbar operator={operator} />
      <VerificationNotice />
      {children}
      <Footer operator={operator} />
    </>
  );
}
