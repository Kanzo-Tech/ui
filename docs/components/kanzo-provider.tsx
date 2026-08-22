"use client";

import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import type { ThemeOption } from "@kanzo-tech/theme";
import { KanzoThemeProvider, cookieStorageAdapter, themeScript } from "@kanzo-tech/ui";

/**
 * The design system owns the theme, appearance included.
 *
 * There is no `appearance` controller here any more. `.dark` selects between the two blocks of the
 * theme, and the provider is what writes it — while next-themes was mounted
 * (`RootProvider`, `attribute: "class"`) there were two writers of the class on `<html>`. It is
 * disabled in `app/layout.tsx`; that and this file are one change.
 *
 * The one thing lost: docs visitors' appearance preference used to live under next-themes' `theme`
 * key. It now lives on the prefs blob (`kanzo_theme_prefs.appearance`), so an existing visitor is
 * unpinned once — following their OS — and re-picks if they want a side held.
 *
 * **Storage is the cookie, and for a theme that is now an optimisation rather than a
 * requirement.** It was a requirement while the SERVER chose which document to inline: a choice
 * already made upstream cannot be corrected in the browser without a flash. Every document travels
 * now — the stylesheet carries the whole catalogue, each theme under its own `[data-theme]` — so colour is an
 * attribute like radius and density, and the pre-paint script applies it before anything is drawn.
 * What the cookie still buys is a server render whose `<html>` already carries the same attributes,
 * which costs nothing here and keeps the markup identical across the boundary.
 *
 * **A component that fetched the chosen document lived here and is gone.** `PaletteStyle` swapped a
 * `<style>` from a per-document route so a switch could repaint without a
 * navigation. That route went with the cookie-chooses-the-document design; the component did not,
 * and every switch away from the default spent a request that answered 404 into a `.catch` that
 * ignored it. It looked like it worked because the attribute was doing the painting all along.
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
  themes,
  defaultTheme,
}: {
  children: ReactNode;
  /**
   * What this tenant publishes — a flat list, because a brand is a theme. The docs site publishes
   * sixteen; a client usually publishes two (one per side) and sees no
   * colour control at all.
   */
  themes: ThemeOption[];
  defaultTheme: string;
}) => {
  useServerInsertedHTML(() => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the anti-FOUC script must be inline.
    <script dangerouslySetInnerHTML={{ __html: themeScript() }} key="kanzo-theme-script" />
  ));

  return (
    <KanzoThemeProvider
      defaultTheme={defaultTheme}
      themes={themes}
      storage={cookieStorageAdapter()}
    >
      {children}
    </KanzoThemeProvider>
  );
};
