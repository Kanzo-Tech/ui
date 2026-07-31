"use client";

import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import type { SwatchOption } from "@kanzo-tech/theme";
import { KanzoThemeProvider, cookieStorageAdapter, themeScript } from "@kanzo-tech/ui";
import { PaletteStyle } from "./palette-style";

/**
 * The design system owns the theme, appearance included.
 *
 * There is no `appearance` controller here any more. `.dark` selects between the two blocks of the
 * compiled palette document, and the provider is what writes it — while next-themes was mounted
 * (`RootProvider`, `attribute: "class"`) there were two writers of the class on `<html>`. It is
 * disabled in `app/layout.tsx`; that and this file are one change.
 *
 * The one thing lost: docs visitors' appearance preference used to live under next-themes' `theme`
 * key. It now lives on the prefs blob (`kanzo_theme_prefs.appearance`), so an existing visitor is
 * unpinned once — following their OS — and re-picks if they want a side held.
 *
 * **Storage is the cookie, and for a palette that is a requirement rather than a taste.** A document
 * is a stylesheet chosen by the SERVER, so the preference has to be readable from the request; a
 * localStorage-only host would paint the default document and correct it after hydration, which is
 * the flash this whole layer exists to prevent. The pre-paint script already reads the cookie first
 * for the same reason.
 *
 * `themeScript` is NOT optional for an SSR host. Everything the provider applies (`data-radius`,
 * `data-font`, `data-mono-font`, `data-font-size` and `.dark`) lives in browser storage, so without
 * the script the server paints the defaults and the client re-skins on hydration — a flash, plus a
 * hydration mismatch in every control whose markup depends on the resolved appearance. It runs in
 * `<head>` before the first paint, and `theme-script.test.ts` holds it to the same `<html>` the
 * provider produces. Colour is not in it, and cannot be: a document is a whole stylesheet, so the
 * script has nothing to write — `app/layout.tsx` serves the chosen one, already compiled.
 */
export const KanzoProvider = ({
  children,
  palettes,
  defaultPalette,
}: {
  children: ReactNode;
  /**
   * What this tenant publishes, brands nested inside their palette. The docs site publishes six
   * palettes, one of which has two brands; a client usually publishes one of each and sees no
   * colour control at all.
   */
  palettes: SwatchOption[];
  defaultPalette: string;
}) => {
  useServerInsertedHTML(() => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the anti-FOUC script must be inline.
    <script dangerouslySetInnerHTML={{ __html: themeScript() }} key="kanzo-theme-script" />
  ));

  return (
    <KanzoThemeProvider
      defaultPalette={defaultPalette}
      palettes={palettes}
      storage={cookieStorageAdapter()}
    >
      <PaletteStyle defaultPalette={defaultPalette} />
      {children}
    </KanzoThemeProvider>
  );
};
