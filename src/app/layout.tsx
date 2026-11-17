import localFont from "next/font/local";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { AppProvider } from "@/components/AppProvider";
import { currentUser } from "@/lib/auth";
import { savedIds } from "@/lib/db";
import { getLanguage } from "@/lib/i18n-server";
import { isOperator } from "@/lib/operations";
import { translate } from "@/lib/i18n";
import "./globals.css";
import "./professional.css";
import "./refinement.css";
const spaceGrotesk = localFont({
  src: "../../public/fonts/space-grotesk-variable.woff2",
  variable: "--font-interface",
  display: "swap",
  weight: "300 700",
});
export const metadata: Metadata = {
  title: {
    default: "Evently — Make room for real life",
    template: "%s · Evently",
  },
  description:
    "Discover events, local experiences and community gatherings across Messina.",
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
      <body className={spaceGrotesk.variable}>
        <ThemeProvider>
          <AppProvider
            initialUser={user}
            initialSaved={user ? await savedIds(user.id) : []}
            initialLanguage={language}
          >
            <a className="skip-link" href="#main">
              {translate(language, "common.skipContent")}
            </a>
            <AppShell operator={isOperator(user)}>{children}</AppShell>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
