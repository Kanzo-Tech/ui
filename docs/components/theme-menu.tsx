"use client";

import type { AppearancePref } from "@kanzo-tech/theme";
import { CORE_PREFS, prefOptions, themeIndex } from "@kanzo-tech/theme";
import {
  Button,
  cn,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  useKanzoTheme,
} from "@kanzo-tech/ui";
import { ChevronDownIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";

/**
 * The theme selector, in the chrome of every page — daisyUI's navbar dropdown, in our parts.
 *
 * It fills fumadocs' `themeSwitch` slot, which is the reserved place for exactly this control: the
 * navbar on the landing layout, the sidebar's footer row in the docs. Both layouts used to pass
 * `themeSwitch={{ enabled: false }}`, because fumadocs' own switch calls next-themes' `useTheme()`
 * and next-themes is off here — so the slot sat empty and the only way to change theme was the
 * Customize panel, three clicks down. A design system's documentation that hides its themes has
 * mislaid the argument.
 *
 * ## A row is the theme, not a picture of one
 *
 * Every row carries `data-theme` and paints itself with `bg-background text-foreground` and three
 * dots of `bg-primary` / `bg-secondary` / `bg-accent`. `[data-theme="x"]` is an ordinary attribute
 * selector — it matches an *element* — so the theme's custom properties land on the row and inherit
 * inward, and the dots resolve on the element that wears them. Twenty-nine themes cost twenty-nine
 * attributes: no swatch table, no colours in JS, and nothing that can disagree with the stylesheet.
 * It is the same mechanism as the catalogue's tiles and the studio's preview pane, one grain
 * smaller, and the same one `PreferencesColor`'s chips already use.
 *
 * The rows keep their own `color-scheme` too — it is declared inside each theme's block — so a dark
 * row renders its scrollbar and its form controls dark while sitting in a light menu.
 *
 * ## Two groups, one value
 *
 * Light and dark are two sets of themes rather than two halves of one, so the menu says so. Both
 * groups are bound to the same value and the same setter; the side that is not worn simply has no
 * checked item.
 *
 * The side travels with the choice, and it takes **two** calls — see `choose`, which carries the
 * reason and the live symptom that found it. `.dark` on `<html>` is a second thing from the theme's
 * own `color-scheme`: it is what the `dark:` variant selects on at the call sites that still ask
 * for one, and the provider writes it from the appearance preference rather than from the theme.
 *
 * ## It is a shortcut, not a second preference
 *
 * The Customize panel still offers Colour, and both controls write the same value through the same
 * provider, so they cannot drift apart — a menu is one click and the panel is where appearance
 * ("follow the OS") and the four non-colour axes live.
 */
export function ThemeMenu({ className }: { className?: string }) {
  const { appearance, resolvedTheme, setAppearance, setTheme, themes } = useKanzoTheme();

  // What the tenant publishes decides what is offered; `themeIndex` only says which side each one
  // is. Reading the offer from the catalogue instead would make this menu the one control in the
  // site that ignores a tenant's policy.
  const sides = { light: [] as ThemeRow[], dark: [] as ThemeRow[] };
  for (const theme of themes) {
    const dark = themeIndex.find((entry) => entry.name === theme.value)?.dark ?? false;
    sides[dark ? "dark" : "light"].push({ dark, label: theme.label, value: theme.value });
  }

  const choose = (value: string, dark: boolean) => {
    if (!value) return;
    const side = dark ? "dark" : "light";
    // **Both calls, and the browser is what showed why.** `setTheme(value, { appearance })` files a
    // theme UNDER a side; it does not move you to that side — the preference is one theme per side,
    // so the panel's Colour card writes the theme with its radio and wears the side with its
    // header button, two acts. From a menu there is only one act. Choosing `forest` while the
    // light side was worn stored it and changed not one pixel, which reads as a control that does
    // nothing. Picking a theme here means "show me this", so the side comes with it.
    setTheme(value, { appearance: side });
    setAppearance(side);
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button className={cn("gap-1.5 font-normal", className)} size="sm" variant="ghost">
          <PaletteIcon />
          {/* No `aria-label`: it would replace the accessible name with a word that is not on the
              button, and the name of the theme you are wearing is the useful half. This reads
              "Theme kanzo", and keeps reading it where the name is hidden for width. */}
          <span className="sr-only">Theme</span>
          <span className="max-sm:sr-only">{resolvedTheme}</span>
          <ChevronDownIcon className="opacity-64" />
        </Button>
      </MenuTrigger>

      <MenuContent className="w-64">
        {/* Appearance first, and it is here rather than in the panel because this menu now owns the
            whole colour axis. **"Follow the system" is why it has to be.** It is the state with no
            value — `""`, the OS deciding — so it cannot be an entry in a list of themes, and while
            the panel held it a reader had one control for a theme and a different one, three clicks
            away, for the side that decides which theme they see. */}
        <MenuRadioGroup
          heading="Appearance"
          onValueChange={(details) => setAppearance(details.value as AppearancePref)}
          value={appearance}
        >
          {APPEARANCES.map((option) => {
            const Icon = APPEARANCE_ICON[option.value] ?? MonitorIcon;
            return (
              <MenuRadioItem key={option.value || "system"} value={option.value}>
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {option.label}
                </span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>

        <MenuSeparator />

        {(["light", "dark"] as const).map((side) => (
          <MenuRadioGroup
            heading={side === "light" ? "Light" : "Dark"}
            key={side}
            onValueChange={(details) => choose(details.value, side === "dark")}
            value={resolvedTheme}
          >
            {sides[side].map((theme) => (
              <MenuRadioItem
                // The dots sit at the far edge, which needs the machine's own text part to grow —
                // it is a flex child sized to its content otherwise, and `ms-auto` inside it has
                // nothing to push against. `data-slot` is the seam this library puts on every part
                // for exactly this, rather than a prop per part.
                className="bg-background text-foreground [&>[data-slot=menu-radio-item-text]]:flex-1"
                data-theme={theme.value}
                key={theme.value}
                value={theme.value}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate">{theme.label}</span>
                  <span aria-hidden className="ms-auto flex items-center gap-1">
                    <span className="size-3 rounded-full bg-primary ring-1 ring-border" />
                    <span className="size-3 rounded-full bg-secondary ring-1 ring-border" />
                    <span className="size-3 rounded-full bg-accent ring-1 ring-border" />
                  </span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        ))}
      </MenuContent>
    </Menu>
  );
}

/**
 * The appearance options, **read off the declaration rather than typed here**.
 *
 * The first draft of this file wrote the three out by hand, which is the one thing `gen-theme.mjs`
 * says in its own comment not to do: the generator is the single place an option is authored, and a
 * list beside a control is a hand-copy that agrees with it until the day it does not. `""` is
 * "ask the OS" and it is a VALUE, not an absent key — that is the declaration's answer, and reading
 * it is how this control inherits it instead of re-deciding it.
 *
 * The icons are ours, because a glyph is not a property of the preference. `""` gets the monitor:
 * it is the one option that is not a side.
 */
const APPEARANCE_ICON: Record<string, typeof SunIcon> = {
  "": MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};
const APPEARANCES = prefOptions(CORE_PREFS.appearance) ?? [];

interface ThemeRow {
  dark: boolean;
  label: string;
  value: string;
}

export default ThemeMenu;
