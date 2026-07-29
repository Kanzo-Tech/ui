"use client";

import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { KanzoThemeProvider, themeScript } from "@kanzo-tech/ui";

/**
 * The design system owns the theme, appearance included.
 *
 * There is no `appearance` controller here any more. `.dark` selects between the two blocks of the
 * compiled palette document, and the provider is what writes it — while next-themes was mounted
 * (`RootProvider`, `attribute: "class"`) there were two writers of the class on `<html>`. It is
 * disabled in `app/layout.tsx`; that and this file are one change.
 *
 * The one thing lost: docs visitors' appearance preference used to live under next-themes' `theme`
 * key. It now lives on the prefs blob (`kanzo_theme_prefs.appearance`), and the migration path
 * reads the DS's own legacy key, so an existing visitor lands on `system` once and re-picks.
 *
 * `themeScript` is NOT optional for an SSR host. Everything the provider applies (`data-radius`,
 * `data-font`, `data-mono-font`, `data-font-size` and `.dark`) lives in browser storage, so without
 * the script the server paints the defaults and the client re-skins on hydration — a flash, plus a
 * hydration mismatch in every control whose markup depends on the resolved appearance. It runs in
 * `<head>` before the first paint, and `theme-script.test.ts` holds it to the same `<html>` the
 * provider produces. Colour is not in it: the palette document is a static `<style>` the server
 * inlines, so the colour maths is done before a byte is sent.
 */
export const KanzoProvider = ({ children }: { children: ReactNode }) => {
  useServerInsertedHTML(() => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the anti-FOUC script must be inline.
    <script dangerouslySetInnerHTML={{ __html: themeScript() }} key="kanzo-theme-script" />
  ));

  return <KanzoThemeProvider>{children}</KanzoThemeProvider>;
};
