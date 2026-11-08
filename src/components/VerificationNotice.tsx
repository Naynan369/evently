"use client";
import Link from "next/link";
import { useApp } from "./AppProvider";
export default function VerificationNotice() {
  const { user, t } = useApp();
  if (!user || user.emailVerified) return null;
  return (
    <div className="verification-notice" role="status">
      {t("verify.notice")}{" "}
      <Link href="/verify-email">{t("verify.link")}</Link>
    </div>
  );
}
