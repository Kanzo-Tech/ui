"use client";

import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { KanzoThemeProvider, themeScript } from "@kanzo-tech/ui";

/**
 * The design system owns the theme, appearance included.
 *
 * There is no `appearance` controller here any more. Light/dark is a side of the palette pair, so
 * `.dark` can only be decided by whatever palette actually resolved — next-themes cannot know
 * that, and while it was mounted (`RootProvider`, `attribute: "class"`) the two disagreed on every
 * pinned palette. It is disabled in `app/layout.tsx`; that and this file are one change.
 *
 * The one thing lost: docs visitors' appearance preference used to live under next-themes' `theme`
 * key. It now lives on the prefs blob (`kanzo_theme_prefs.appearance`), and the migration path
 * reads the DS's own legacy key, so an existing visitor lands on `system` once and re-picks.
 *
 * `themeScript` is NOT optional for an SSR host. Everything the provider applies (`data-palette`,
 * `data-accent`, `data-radius`, the custom tints…) lives in browser storage, so without the script
 * the server paints the default theme and the client re-skins on hydration — a flash, plus a
 * hydration mismatch in every control whose markup depends on the resolved appearance. It runs in
 * `<head>` before the first paint, and `theme-script.test.ts` holds it to the same `<html>` the
 * provider produces.
 */
export const KanzoProvider = ({ children }: { children: ReactNode }) => {
  useServerInsertedHTML(() => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the anti-FOUC script must be inline.
    <script dangerouslySetInnerHTML={{ __html: themeScript() }} key="kanzo-theme-script" />
  ));

  return <KanzoThemeProvider>{children}</KanzoThemeProvider>;
};
