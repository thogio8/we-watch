import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Mono } from "next/font/google";
import { DrawSessionProvider } from "@/features/draw/DrawSessionProvider";
import { APP_DESCRIPTION, APP_NAME, BRAND } from "@/features/pwa/brand";
import { BottomNav, BottomNavFallback } from "@/ui/BottomNav";
import "@/styles/tokens.css";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // Home screen app on iPhone. "default" keeps a light status bar with dark
  // text above the content, which suits the cream paper ("black-translucent"
  // would draw white text over it).
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: BRAND.paper,
  // Edge to edge in standalone mode; the shell pads with the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${mono.variable}`}>
      <body>
        {/* Above the routes: the draw survives tab switches (spec §4.1). */}
        <DrawSessionProvider>
          <div className="shell">{children}</div>
        </DrawSessionProvider>
        <Suspense fallback={<BottomNavFallback />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
