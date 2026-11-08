"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
export default function AccountActions({
  compact = false,
  onSignOut,
}: { compact?: boolean; onSignOut?: () => void } = {}) {
  const { setSession, toast, t } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className={compact ? "account-signout" : "button button-outline"}
      onClick={async () => {
        setBusy(true);
        try {
          await api("auth/logout", { method: "POST" });
          setSession(null, []);
          onSignOut?.();
          router.push("/");
          router.refresh();
        } catch (e) {
          toast((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {compact && <FiLogOut aria-hidden="true" />}
      {busy ? t("auth.signingOut") : t("auth.signOut")}
    </button>
  );
}
