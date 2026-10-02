"use client";

import * as React from "react";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import type { Appearance, ThemeOption } from "@kanzo-tech/theme";
import { InfoIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Badge } from "../simples/badge.js";
import { SegmentGroup } from "../simples/segment-group.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { KanzoTheme } from "../theme/KanzoTheme.js";
import { useKanzoTheme } from "../theme/theme-context.js";
import { themeRetiredCopy, type ThemeRetiredCopy } from "./theme-notice.js";
import { ThemePreview } from "./ThemePreview.js";

/** Every string the picker authors. The theme labels are the tenant's and are never reworded. */
export interface ThemePickerCopy {
  /** The label of the Light · Dark control. */
  appearance: string;
  light: string;
  dark: string;
  /** The title of the light side's card. */
  day: string;
  dayDescription: string;
  /** The title of the dark side's card. */
  night: string;
  nightDescription: string;
  active: string;
  /** The notice shown when the tenant withdrew the theme this user had chosen. */
  retired: ThemeRetiredCopy;
}

const DEFAULT_COPY: ThemePickerCopy = {
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  day: "Light theme",
  dayDescription: "Worn while the appearance is light.",
  night: "Dark theme",
  nightDescription: "Worn while the appearance is dark.",
  active: "Active",
  retired: {},
};

export interface ThemePickerProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  copy?: Partial<ThemePickerCopy>;
}

const SIDES: readonly Appearance[] = ["light", "dark"];

/**
 * The theme choice, laid out as GitHub's Settings → Appearance.
 *
 * A **Light · Dark** control picks the side the page wears, and two cards always follow — a light
 * theme and a dark theme — each a large {@link ThemePreview} of its choice, the theme's name, and a
 * row of round swatches: a radio group, one swatch per theme of that side, painted by the theme's own
 * tokens. Choosing a swatch files the theme under its card's side and never flips the appearance; the
 * card of the side on screen carries *Active*.
 *
 * It offers what the provider's `themes` lists and obeys the tenant's policy: a withheld or pinned
 * appearance draws no control, a withheld or pinned theme draws no cards. With neither offered it
 * renders nothing.
 */
export function ThemePicker({ copy, className, slot, ...rest }: ThemePickerProps) {
  const c = { ...DEFAULT_COPY, ...copy };
  const { appearance, corePrefs, defaultThemeFor, resolvedTheme, retiredTheme, setAppearance, setTheme, themeByAppearance, themes } =
    useKanzoTheme();
  const id = React.useId();

  const themesOffered = corePrefs.themeByAppearance?.offered !== false;
  const appearanceOffered = corePrefs.appearance?.offered !== false;
  if (!themesOffered && !appearanceOffered) return null;

  const selectedFor = (side: Appearance) =>
    (side === appearance ? resolvedTheme : themeByAppearance[side]) || defaultThemeFor(side);
  const onSide = (side: Appearance) => {
    const own = themes.filter((t) => (t.dark ? "dark" : "light") === side);
    return own.length > 0 ? own : themes;
  };
  const retired = retiredTheme ? themeRetiredCopy(c.retired, retiredTheme) : null;

  return (
    <div className={cn("@container flex flex-col gap-5", className)} {...rest} data-slot={slot ?? "theme-picker"}>
      {appearanceOffered ? (
        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm" id={`${id}-appearance`}>
            {c.appearance}
          </span>
          <SegmentGroup
            className="w-fit"
            ids={{ label: `${id}-appearance` }}
            onValueChange={(d) => d.value && setAppearance(d.value as Appearance)}
            options={[
              { value: "light", label: c.light },
              { value: "dark", label: c.dark },
            ]}
            value={appearance}
          />
        </div>
      ) : null}

      {themesOffered ? (
        <div className="grid items-start gap-4 @xl:grid-cols-2">
          {SIDES.map((side) => {
            const titleId = `${id}-${side}`;
            const value = selectedFor(side);
            const chosen = themes.find((t) => t.value === value);
            const active = side === appearance;
            return (
              <section
                aria-labelledby={titleId}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-box border bg-card text-card-foreground",
                  active && "border-primary",
                )}
                data-active={active || undefined}
                data-slot="theme-picker-card"
                key={side}
              >
                <header
                  className={cn(
                    "flex items-center gap-2 border-b px-4 py-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                    active && "border-primary bg-primary/10",
                  )}
                >
                  {side === "light" ? <SunIcon /> : <MoonIcon />}
                  <h3 className="min-w-0 font-semibold text-sm" id={titleId}>
                    {side === "light" ? c.day : c.night}
                  </h3>
                  {active ? (
                    <Badge className="ms-auto" size="sm" variant="info">
                      {c.active}
                    </Badge>
                  ) : null}
                </header>
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-muted-foreground text-sm">{side === "light" ? c.dayDescription : c.nightDescription}</p>
                  <ThemePreview appearance={side} theme={value} />
                  <p className="min-w-0 text-pretty break-words font-medium text-sm" data-slot="theme-picker-name">
                    {chosen?.label ?? value}
                  </p>
                  <ArkRadioGroup.Root
                    className="flex flex-wrap gap-2"
                    ids={{ label: titleId }}
                    onValueChange={(d) => d.value && setTheme(d.value, { appearance: side })}
                    orientation="horizontal"
                    value={value}
                  >
                    {onSide(side).map((theme) => (
                      <ThemeSwatch key={theme.value} side={side} theme={theme} />
                    ))}
                  </ArkRadioGroup.Root>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

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

/**
 * One theme as a round swatch: its background and its primary split on the diagonal, read off a
 * scoped {@link KanzoTheme} so the colours are the theme's real tokens. The label is the radio's
 * accessible name; the tooltip says it to a pointer.
 */
function ThemeSwatch({ theme, side }: { theme: ThemeOption; side: Appearance }) {
  return (
    <ArkRadioGroup.Item
      className="group/swatch relative cursor-pointer rounded-full data-disabled:pointer-events-none data-disabled:opacity-64"
      data-slot="theme-picker-swatch"
      value={theme.value}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block rounded-full p-0.5 ring-2 ring-transparent transition-shadow group-hover/swatch:ring-border group-data-[state=checked]/swatch:ring-primary outline-ring outline-offset-2 group-data-focus-visible/swatch:outline-2">
            <KanzoTheme
              aria-hidden
              appearance={side}
              className="block size-7 rounded-full border border-border bg-[linear-gradient(135deg,var(--background)_50%,var(--primary)_50%)]"
              theme={theme.value}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{theme.label}</TooltipContent>
      </Tooltip>
      <ArkRadioGroup.ItemText className="sr-only">{theme.label}</ArkRadioGroup.ItemText>
      <ArkRadioGroup.ItemHiddenInput />
    </ArkRadioGroup.Item>
  );
}
