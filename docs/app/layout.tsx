import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { KanzoProvider } from "@/components/kanzo-provider";
import { themeIndex } from "@kanzo-tech/theme";
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
        {/* No stylesheet is inlined here any more. The catalogue travels in `styles.css` —
            twenty-nine themes, each one flat block under its own `[data-theme]` — so choosing one
            is an attribute write and this layout stays static. It used to inline *the chosen document*,
            read from a cookie, which made the layout async and every page under it dynamic. */}
        {/* next-themes OFF. `RootProvider` mounts it with `attribute: "class"`, which made two
            writers of `.dark` on <html>; and 0.4.6 defaults `enableColorScheme: true`, writing
            `documentElement.style.colorScheme` — an inline declaration that outranks every rule
            permanently, so the `color-scheme` each theme file declares could never
            set it. `.dark` is written by KanzoThemeProvider, alone. */}
        {/* `search.options.type: "static"` is the client half of `app/api/search/route.ts`'s
            `staticGET`: it fetches the emitted index once and searches it in the browser, because
            a static host has nothing to answer a query with. Setting one without the other fails
            the way this repository keeps paying for — no error, just a search box that returns
            nothing. */}
        <RootProvider search={{ options: { type: "static" } }} theme={{ enabled: false }}>
          <KanzoProvider defaultTheme="kanzo" themes={themeIndex.map((t) => ({ value: t.name, label: t.name }))}>
            {children}
          </KanzoProvider>
        </RootProvider>
      </body>
    </html>
  );
}
