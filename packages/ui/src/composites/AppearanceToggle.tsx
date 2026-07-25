"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button, type ButtonProps } from "../simples/button.js";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";

export interface AppearanceToggleLabels {
  light: string;
  dark: string;
  system: string;
}

export interface AppearanceToggleProps {
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  /** Accessible action label for the control (i18n). */
  label?: string;
  /** Override the state names shown in the tooltip (i18n). */
  labels?: Partial<AppearanceToggleLabels>;
}

const DEFAULT_LABELS: AppearanceToggleLabels = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Appearance toggle — Shark's idiom: a compact icon button that flips light↔dark on click.
 * The sun/moon crossfade is keyed off `.dark` in CSS, so the icon always shows the RESOLVED
 * appearance. Shift- or Alt-click reaches `system`, the third state the underlying
 * {@link useKanzoTheme} model still supports; a small monitor badge marks that auto state.
 *
 * **SSR.** The resolved appearance is only knowable in the browser (localStorage / cookie /
 * `matchMedia`), so the state-bearing attributes (`aria-pressed`, `data-appearance`, `title`)
 * are withheld until mount — otherwise the server would emit `light`, the client would hydrate
 * `dark`, and React would report a hydration mismatch it does not patch. This costs no FOUC:
 * what paints is the sun/moon crossfade, and that is keyed off `.dark` in CSS, which
 * `themeScript` sets on `<html>` before the first paint. Inject it — it is not optional.
 */
export const AppearanceToggle = ({
  className,
  size = "icon-md",
  variant = "ghost",
  label = "Toggle appearance",
  labels,
}: AppearanceToggleProps = {}) => {
  const { appearance, resolvedAppearance, setAppearance } = useKanzoTheme();
  const l = { ...DEFAULT_LABELS, ...labels };
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey || e.altKey) {
      setAppearance("system");
      return;
    }
    setAppearance(resolvedAppearance === "dark" ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={label}
      aria-pressed={mounted ? resolvedAppearance === "dark" : undefined}
      data-appearance={mounted ? appearance : undefined}
      title={mounted ? `Appearance: ${l[appearance]} · Shift-click for system` : label}
      className={cn("group", className)}
      onClick={onClick}
    >
      <SunIcon className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <MonitorIcon className="absolute end-0.5 bottom-0.5 size-2.5 opacity-0 transition-opacity group-data-[appearance=system]:opacity-100" />
    </Button>
  );
};
