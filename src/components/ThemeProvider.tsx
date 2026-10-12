"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="evently-theme-v2"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}
