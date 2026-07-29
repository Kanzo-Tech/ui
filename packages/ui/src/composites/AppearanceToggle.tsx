"use client";

import * as React from "react";
import type { Appearance } from "@kanzo-tech/theme";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button, type ButtonProps } from "../simples/button.js";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";

export interface AppearanceToggleLabels {
  light: string;
  dark: string;
}

export interface AppearanceToggleProps {
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  /** Name announced before mount, and the prefix of the mounted name (i18n). */
  label?: string;
  /** Override the state names announced and shown in the tooltip (i18n). */
  labels?: Partial<AppearanceToggleLabels>;
  /**
   * Compose the accessible name. The default frame is English (`"<label>: <current>. Switch to
   * <next>"`); a caller who translates `label` and `labels` needs this too, or the sentence is
   * half-translated — which is what a hard-coded frame did to the tooltip this replaces.
   */
  formatName?: (parts: { label: string; current: string; next: string }) => string;
}

const DEFAULT_FORMAT = ({ label, current, next }: { label: string; current: string; next: string }) =>
  `${label}: ${current}. Switch to ${next.toLowerCase()}`;

const DEFAULT_LABELS: AppearanceToggleLabels = { light: "Light", dark: "Dark" };

/**
 * Appearance toggle — one compact button that flips light ⇄ dark, sun ⇄ moon.
 *
 * **`system` is not a stop on the flip; it is the initial value.** `prefers-color-scheme` is read
 * either way and that part is not a feature — without it the first visit has to guess, and guessing
 * wrong flashes white at every dark-mode user. So the only real question was whether "follow the OS"
 * is a state you can *return* to, and it is: `DEFAULT_PREFS.appearance` is `"system"`, so an app
 * with nothing stored follows the OS until the first click, and the Preferences panel's Reset
 * spreads `DEFAULT_PREFS` and puts it back. A third face on the cycle bought reachability for a
 * state most people never leave, in the control they touch most.
 *
 * `data-appearance` still carries the *preference*, and that is worth keeping now that it drives no
 * icon: `.dark` says which side is applied, and only this says whether the user pinned it.
 *
 * **Accessibility.** No `aria-pressed`, though at two states it would be well-formed. The name
 * already carries both halves of the contract — what the control is in, and what one click will do
 * (`"Appearance: Dark. Switch to light"`) — and `aria-pressed` would announce the state a second
 * time, less precisely: "toggle button, pressed" leaves the listener to supply that pressed means
 * dark. Screen readers re-announce the name of the focused element, which a button that never moves
 * focus always is, so the name change *is* the announcement.
 *
 * Rejected: a visually hidden `role="status"` echoing the new state — it duplicates the name of the
 * focused element, so the change is spoken twice.
 *
 * **SSR.** The resolved appearance is only knowable in the browser (localStorage / cookie /
 * `matchMedia`), so the state-bearing attributes (`aria-label`'s state clause, `data-appearance`,
 * `title`) are withheld until mount — otherwise the server would emit `light`, the client would
 * hydrate `dark`, and React would report a hydration mismatch it does not patch. This costs no
 * FOUC: what paints is the sun/moon crossfade, and that is keyed off `.dark` in CSS, which
 * `themeScript` sets on `<html>` before the first paint. Inject it — it is not optional.
 */
export const AppearanceToggle = ({
  className,
  size = "icon-md",
  variant = "ghost",
  label = "Appearance",
  labels,
  formatName = DEFAULT_FORMAT,
}: AppearanceToggleProps = {}) => {
  const { appearance, resolvedAppearance, setAppearance } = useKanzoTheme();
  const l = { ...DEFAULT_LABELS, ...labels };
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Flips what is APPLIED, not what is stored. From `system` the click pins the opposite of what
  // the user is looking at, which is the only reading of "toggle" that matches the screen.
  const next: Appearance = resolvedAppearance === "dark" ? "light" : "dark";
  const name = mounted
    ? formatName({ label, current: l[resolvedAppearance], next: l[next] })
    : label;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={name}
      data-appearance={mounted ? appearance : undefined}
      title={name}
      className={cn("group", className)}
      onClick={() => setAppearance(next)}
    >
      {/* Crossfade off `.dark`, not off state: the pre-mount face is already the RESOLVED
          appearance, because `themeScript` sets the class before the first paint. That is what
          makes withholding the state-bearing attributes until mount cost no FOUC. */}
      <SunIcon className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
};
