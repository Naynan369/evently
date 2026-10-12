"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
type AppContext = {
  user: User | null;
  saved: string[];
  setSession: (user: User | null, saved?: string[]) => void;
  toggleSave: (id: string) => Promise<void>;
  toast: (message: string) => void;
};
const Context = createContext<AppContext | null>(null);
export function AppProvider({
  children,
  initialUser,
  initialSaved,
}: {
  children: ReactNode;
  initialUser: User | null;
  initialSaved: string[];
}) {
  const [user, setUser] = useState(initialUser);
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const path = usePathname();
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
          ? "Added to your saved events"
          : "Removed from saved events",
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
