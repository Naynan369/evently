import localFont from "next/font/local";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { AppProvider } from "@/components/AppProvider";
import { currentUser } from "@/lib/auth";
import { savedIds } from "@/lib/db";
import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import "./globals.css";
import "./professional.css";
import "./refinement.css";
const inter = localFont({
  src: "../../public/fonts/inter-variable.woff2",
  variable: "--font-interface",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: {
    default: "Evently — Make room for real life",
    template: "%s · Evently",
  },
  description:
    "Discover your next favorite experience. Find events, meet your people and make moments that matter.",
};
export const runtime = "nodejs";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const language = await getLanguage();
  return (
    <html lang={language} suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>
          <AppProvider
            initialUser={user}
            initialSaved={user ? await savedIds(user.id) : []}
            initialLanguage={language}
          >
            <a className="skip-link" href="#main">
              {translate(language, "common.skipContent")}
            </a>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
