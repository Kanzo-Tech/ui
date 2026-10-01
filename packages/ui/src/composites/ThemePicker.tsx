"use client";

import * as React from "react";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import type { Appearance, ThemeOption } from "@kanzo-tech/theme";
import { InfoIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Badge } from "../simples/badge.js";
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupItem,
  RadioGroupLabel,
} from "../simples/radio-group.js";
import { useKanzoTheme } from "../theme/theme-context.js";
import { themeRetiredCopy, type ThemeRetiredCopy } from "./theme-notice.js";
import { ThemePreview } from "./ThemePreview.js";

/** Every string the picker authors. The theme labels are the tenant's and are never reworded. */
export interface ThemePickerCopy {
  mode: string;
  sync: string;
  single: string;
  day: string;
  night: string;
  theme: string;
  active: string;
  /** The notice shown when the tenant withdrew the theme this user had chosen. */
  retired: ThemeRetiredCopy;
}

const DEFAULT_COPY: ThemePickerCopy = {
  mode: "Theme mode",
  sync: "Sync with system",
  single: "Single theme",
  day: "Day theme",
  night: "Night theme",
  theme: "Theme",
  active: "Active",
  retired: {},
};

export interface ThemePickerProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  copy?: Partial<ThemePickerCopy>;
}

const sideOf = (theme: ThemeOption): Appearance => (theme.dark ? "dark" : "light");

/**
 * The theme choice, modelled on GitHub's Settings → Appearance.
 *
 * **Theme mode** decides whether the OS picks the side (*Sync with system*: a day theme and a night
 * theme, each its own group) or the user does (*Single theme*: one group, and choosing a theme wears
 * its side). Each group is a radio group of cards: a {@link ThemePreview} painted by the theme it
 * offers, its name, and *Active* on the one on screen.
 *
 * It offers what the provider's `themes` lists and obeys the tenant's policy: a withheld or pinned
 * theme axis draws no theme groups, a withheld or pinned appearance draws no mode control and only
 * the side it resolves to. With neither offered it renders nothing.
 */
export function ThemePicker({ copy, className, slot, ...rest }: ThemePickerProps) {
  const c = { ...DEFAULT_COPY, ...copy };
  const {
    appearance,
    corePrefs,
    defaultThemeFor,
    resolvedAppearance,
    resolvedTheme,
    retiredTheme,
    setAppearance,
    setTheme,
    themeByAppearance,
    themes,
  } = useKanzoTheme();

  const themesOffered = corePrefs.themeByAppearance?.offered !== false;
  const modeOffered = corePrefs.appearance?.offered !== false;
  if (!themesOffered && !modeOffered) return null;

  const sync = appearance === "";
  const selectedFor = (side: Appearance) =>
    (side === resolvedAppearance ? resolvedTheme : themeByAppearance[side]) || defaultThemeFor(side);
  const onSide = (side: Appearance) => {
    const own = themes.filter((t) => sideOf(t) === side);
    return own.length > 0 ? own : themes;
  };

  const groups: { key: string; label: string; side: Appearance | null; options: ThemeOption[] }[] = sync
    ? [
        { key: "light", label: c.day, side: "light", options: onSide("light") },
        { key: "dark", label: c.night, side: "dark", options: onSide("dark") },
      ]
    : [
        {
          key: "single",
          label: c.theme,
          // A side the user cannot leave offers only its own themes: choosing one of the other side
          // would file a theme the pinned appearance never wears.
          side: modeOffered ? null : resolvedAppearance,
          options: modeOffered ? themes : onSide(resolvedAppearance),
        },
      ];

  const choose = (value: string, side: Appearance | null) => {
    const theme = themes.find((t) => t.value === value);
    if (!theme) return;
    if (side) return setTheme(value, { appearance: side });
    setTheme(value, { appearance: sideOf(theme) });
    setAppearance(sideOf(theme));
  };

  const retired = retiredTheme ? themeRetiredCopy(c.retired, retiredTheme) : null;

  return (
    <div className={cn("flex flex-col gap-5", className)} {...rest} data-slot={slot ?? "theme-picker"}>
      {modeOffered ? (
        <RadioGroup
          className="flex-row flex-wrap gap-x-5 gap-y-2"
          onValueChange={(d) => setAppearance(d.value === "sync" ? "" : resolvedAppearance)}
          orientation="horizontal"
          value={sync ? "sync" : "single"}
        >
          <RadioGroupLabel className="w-full font-medium text-sm">{c.mode}</RadioGroupLabel>
          <RadioGroupItem value="sync">{c.sync}</RadioGroupItem>
          <RadioGroupItem value="single">{c.single}</RadioGroupItem>
        </RadioGroup>
      ) : null}

      {themesOffered
        ? groups.map((group) => (
            <RadioGroup
              columns="auto"
              key={group.key}
              onValueChange={(d) => d.value && choose(d.value, group.side)}
              value={group.side ? selectedFor(group.side) : resolvedTheme}
            >
              <RadioGroupLabel className="col-span-full font-medium text-sm">{group.label}</RadioGroupLabel>
              {group.options.map((theme) => (
                <RadioGroupCard className="flex-col gap-2 p-2" key={theme.value} value={theme.value}>
                  <ThemePreview appearance={sideOf(theme)} theme={theme.value} />
                  <span className="flex min-w-0 items-center gap-2">
                    <ArkRadioGroup.ItemText className="truncate font-medium text-sm">
                      {theme.label}
                    </ArkRadioGroup.ItemText>
                    {theme.value === resolvedTheme ? (
                      <Badge aria-hidden className="ms-auto shrink-0" size="sm" variant="info">
                        {c.active}
                      </Badge>
                    ) : null}
                  </span>
                </RadioGroupCard>
              ))}
            </RadioGroup>
          ))
        : null}

      {retired ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>{retired.title}</AlertTitle>
          <AlertDescription>{retired.description}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
