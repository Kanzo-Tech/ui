"use client";

import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { useTheme } from "next-themes";
import { KanzoThemeProvider, themeScript } from "@kanzo-tech/ui";

// next-themes' own storage key. Passing it makes `themeScript` read the SAME preference the
// docs already persist, so the two agree on `.dark` instead of racing to a different answer.
const NEXT_THEMES_KEY = "theme";

/**
 * Hands fumadocs' theme manager to the design system instead of letting both fight over
 * `.dark` on `<html>`.
 *
 * This is the `appearance` contract the provider was built for — the docs are the first real
 * consumer to exercise it, which is the point of running them on App Router at all.
 *
 * `themeScript` is NOT optional for an SSR host. Everything the provider applies (`data-accent`,
 * `data-radius`, `data-density`, the custom tints…) lives in browser storage, so without the
 * script the server paints the default theme and the client re-skins on hydration — a flash,
 * plus a hydration mismatch in every control whose markup depends on the resolved appearance.
 * It runs in `<head>` before the first paint.
 */
export const KanzoProvider = ({ children }: { children: ReactNode }) => {
  const { resolvedTheme, setTheme } = useTheme();

  useServerInsertedHTML(() => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the anti-FOUC script must be inline.
    <script
      dangerouslySetInnerHTML={{ __html: themeScript({ appearanceKey: NEXT_THEMES_KEY }) }}
      key="kanzo-theme-script"
    />
  ));

  return (
    <KanzoThemeProvider appearance={{ resolvedTheme, setTheme }}>{children}</KanzoThemeProvider>
  );
};
