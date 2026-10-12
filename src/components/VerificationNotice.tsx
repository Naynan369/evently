"use client";
import Link from "next/link";
import { useApp } from "./AppProvider";
export default function VerificationNotice() {
  const { user } = useApp();
  if (!user || user.emailVerified) return null;
  return (
    <div className="verification-notice" role="status">
      One last step: verify your email to book events and connect your music.{" "}
      <Link href="/verify-email">Verify email →</Link>
    </div>
  );
}
