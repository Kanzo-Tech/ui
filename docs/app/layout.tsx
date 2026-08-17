import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { KanzoProvider } from "@/components/kanzo-provider";
import { allPaletteCss, defaultPalette, paletteOptions } from "@/lib/palette";
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
  // Every published document, once. It used to be *the chosen one*, read from a cookie — which made
  // this layout async and every page under it dynamic. All six are 8.7 kB gzipped together, so the
  // choice moved to a `data-palette` attribute and the pages are static again.
  const css = allPaletteCss();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        {/* Order-independent on purpose: each document is scoped to `[data-palette="<id>"]:root`,
            which outranks `tokens.css`'s bare `:root` on specificity. Whether React hoists this
            before or after the imported sheet cannot change which palette wins — and with no
            attribute set, none of them applies and the page is Kanzo. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: compiled stylesheets, from disk. */}
        <style dangerouslySetInnerHTML={{ __html: css }} id="kanzo-palettes" />
        {/* next-themes OFF. `RootProvider` mounts it with `attribute: "class"`, which made two
            writers of `.dark` on <html>; and 0.4.6 defaults `enableColorScheme: true`, writing
            `documentElement.style.colorScheme` — an inline declaration that outranks every rule
            permanently, so the `:root` / `.dark` blocks of a compiled palette document could never
            set it. `.dark` is written by KanzoThemeProvider, alone. */}
        <RootProvider theme={{ enabled: false }}>
          <KanzoProvider defaultPalette={defaultPalette} palettes={paletteOptions}>
            {children}
          </KanzoProvider>
        </RootProvider>
      </body>
    </html>
  );
}
