"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/client";
import {
  LANGUAGE_COOKIE,
  setGoogleTranslations,
  translate,
  type GoogleTranslationMap,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import type { User } from "@/lib/types";
type AppContext = {
  user: User | null;
  saved: string[];
  language: Language;
  googleTranslated: boolean;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  setSession: (user: User | null, saved?: string[]) => void;
  toggleSave: (id: string) => Promise<void>;
  toast: (message: string) => void;
};
const Context = createContext<AppContext | null>(null);
export function AppProvider({
  children,
  initialUser,
  initialSaved,
  initialLanguage,
  initialGoogleTranslations,
}: {
  children: ReactNode;
  initialUser: User | null;
  initialSaved: string[];
  initialLanguage: Language;
  initialGoogleTranslations: GoogleTranslationMap | null;
}) {
  setGoogleTranslations(initialGoogleTranslations);
  const [user, setUser] = useState(initialUser);
  const [saved, setSaved] = useState(initialSaved);
  const [language, setLanguageState] = useState(initialLanguage);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const path = usePathname();
  function setLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    document.documentElement.lang =
      nextLanguage === "it" && initialGoogleTranslations
        ? "it-x-mtfrom-en"
        : nextLanguage;
    setLanguageState(nextLanguage);
    router.refresh();
  }
  function toast(value: string) {
    setMessage(value);
    window.setTimeout(
      () => setMessage((current) => (current === value ? "" : current)),
      5000,
    );
  }
  async function toggleSave(id: string) {
    if (!user) {
      router.push("/login?next=" + encodeURIComponent(path));
      return;
    }
    try {
      const result = await api<{ saved: string[] }>("saved", {
        method: "PUT",
        body: { eventId: id, saved: !saved.includes(id) },
      });
      setSaved(result.saved);
      toast(
        result.saved.includes(id)
          ? translate(language, "toast.savedAdded")
          : translate(language, "toast.savedRemoved"),
      );
    } catch (error) {
      toast((error as Error).message);
    }
  }
  return (
    <Context.Provider
      value={{
        user,
        saved,
        language,
        googleTranslated: language === "it" && Boolean(initialGoogleTranslations),
        t: (key, values) => translate(language, key, values),
        setLanguage,
        setSession: (next, ids) => {
          setUser(next);
          if (ids) setSaved(ids);
        },
        toggleSave,
        toast,
      }}
    >
      {children}
      <div
        className={"toast" + (message ? " visible" : "")}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
