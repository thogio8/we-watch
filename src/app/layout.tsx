import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Mono } from "next/font/google";
import { BottomNav } from "@/ui/BottomNav";
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
  title: "we-watch",
  description: "Swipe des films, tirage de la soirée",
};

export const viewport: Viewport = {
  themeColor: "#fff4d6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${mono.variable}`}>
      <body>
        <div className="shell">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
