"use client";

import { Button, cn, useKanzoTheme } from "@kanzo-tech/ui";
import { MoonIcon, SunIcon } from "lucide-react";

/**
 * The navbar's appearance toggle: Light or Dark, nothing else. It fills fumadocs' `themeSwitch`
 * slot — the navbar on the landing layout, the sidebar's footer row in the docs.
 *
 * **It flips the side, never the family.** The site wears the corporate `kanzo` pair by default, so
 * the toggle reads as kanzo ↔ kanzo-dark. Another family is chosen from the
 * [catalogue](/docs/themes) with *Wear it*, which files that family under both sides; the toggle
 * then flips between that family's two themes rather than dragging the reader back to kanzo — one
 * control, one act.
 *
 * **Its markup does not depend on the side**, which is what keeps it out of hydration warnings. The
 * provider's preferences live in a cookie the server render does not read, so a server render and a
 * dark client render disagree about anything drawn from `appearance`. Both icons are rendered and
 * `dark:` picks one — `.dark` is on `<html>` before the first paint, written by `themeScript` — and
 * the accessible name is the act, not the state.
 */
export function ThemeMenu({ className }: { className?: string }) {
  const { appearance, setAppearance } = useKanzoTheme();

  return (
    <Button
      className={cn(className)}
      onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
      size="icon-sm"
      variant="ghost"
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
      <span className="sr-only">Toggle dark mode</span>
    </Button>
  );
}

export default ThemeMenu;
