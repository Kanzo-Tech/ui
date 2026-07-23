import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { KanzoProvider } from "@/components/kanzo-provider";
import "@kanzo-tech/ui/styles.css";
import "./global.css";

// The theme's `data-font` / `data-mono-font` axes resolve `--font-sans` / `--font-mono` to these
// exact CSS variables (see @kanzo-tech/theme themes.css). Without them, selecting Geist/Inter/
// JetBrains in the Preferences customizer silently fell back to the system stack — the font
// controls appeared to do nothing. Loading them here defines the variables on <html>, so the
// switch is real (and covers the /view showcase iframes, which share this root layout).
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata = {
  title: "Kanzo UI",
  description: "Ark UI + tailwind-variants primitives over design tokens.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <KanzoProvider>{children}</KanzoProvider>
        </RootProvider>
      </body>
    </html>
  );
}
