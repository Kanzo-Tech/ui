import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { KanzoProvider } from "@/components/kanzo-provider";
import {
  defaultPalette,
  identityOptions,
  paletteCss,
  paletteOptions,
  requestedPalette,
} from "@/lib/palette";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The chosen palette, decided from the request rather than after hydration. `null` for the default
  // one, whose stylesheet is `tokens.css` and is already imported above.
  const palette = await requestedPalette();
  const css = paletteCss(palette);
  // The identities belong to the SELECTED document, so they are read per request beside its
  // stylesheet. A tenant publishing one brand gets `[]` and the panel's section never renders.
  const identities = identityOptions(palette);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        {/* Order-independent on purpose: every non-default document is compiled with `elevate`, so
            its `:root:root` blocks outrank `tokens.css` on specificity. Whether React hoists this
            before or after the imported sheet cannot change which palette wins. */}
        {css ? (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a compiled stylesheet, from disk.
          <style dangerouslySetInnerHTML={{ __html: css }} id="kanzo-palette" />
        ) : null}
        {/* next-themes OFF. `RootProvider` mounts it with `attribute: "class"`, which made two
            writers of `.dark` on <html>; and 0.4.6 defaults `enableColorScheme: true`, writing
            `documentElement.style.colorScheme` — an inline declaration that outranks every rule
            permanently, so the `:root` / `.dark` blocks of a compiled palette document could never
            set it. `.dark` is written by KanzoThemeProvider, alone. */}
        <RootProvider theme={{ enabled: false }}>
          <KanzoProvider
            defaultPalette={defaultPalette}
            identities={identities}
            palettes={paletteOptions}
          >
            {children}
          </KanzoProvider>
        </RootProvider>
      </body>
    </html>
  );
}
