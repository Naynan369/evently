import localFont from "next/font/local";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerificationNotice from "@/components/VerificationNotice";
import ThemeProvider from "@/components/ThemeProvider";
import { AppProvider } from "@/components/AppProvider";
import { currentUser } from "@/lib/auth";
import { savedIds } from "@/lib/db";
import "./globals.css";
import "./professional.css";
const jetBrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono-variable.ttf",
  variable: "--font-interface",
  display: "swap",
  weight: "100 800",
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={jetBrainsMono.variable}>
        <ThemeProvider>
          <AppProvider
            initialUser={user}
            initialSaved={user ? await savedIds(user.id) : []}
          >
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <Navbar />
            <VerificationNotice />
            {children}
            <Footer />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
