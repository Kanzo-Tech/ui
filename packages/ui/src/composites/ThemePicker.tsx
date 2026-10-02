"use client";

import * as React from "react";
import { createListCollection } from "@ark-ui/react/collection";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import { Select as ArkSelect } from "@ark-ui/react/select";
import type { Appearance, ThemeOption } from "@kanzo-tech/theme";
import { InfoIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Badge } from "../simples/badge.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../simples/select.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { KanzoTheme } from "../theme/KanzoTheme.js";
import { useKanzoTheme } from "../theme/theme-context.js";
import { themeRetiredCopy, type ThemeRetiredCopy } from "./theme-notice.js";
import { ThemePreview } from "./ThemePreview.js";

/** Every string the picker authors. The theme labels are the tenant's and are never reworded. */
export interface ThemePickerCopy {
  mode: string;
  sync: string;
  /** The line beside the mode select while it reads *Sync with system*. */
  syncDescription: string;
  single: string;
  /** The line beside the mode select while it reads *Single theme*. */
  singleDescription: string;
  /** The title of the light side's card. */
  day: string;
  dayDescription: string;
  /** The title of the dark side's card. */
  night: string;
  nightDescription: string;
  /** The title of the single-mode card. */
  theme: string;
  active: string;
  /** The notice shown when the tenant withdrew the theme this user had chosen. */
  retired: ThemeRetiredCopy;
}

const DEFAULT_COPY: ThemePickerCopy = {
  mode: "Theme mode",
  sync: "Sync with system",
  syncDescription: "Matches your system's light or dark setting.",
  single: "Single theme",
  singleDescription: "One theme, whatever your system is set to.",
  day: "Light theme",
  dayDescription: "Active when your system is set to light mode.",
  night: "Dark theme",
  nightDescription: "Active when your system is set to dark mode.",
  theme: "Theme",
  active: "Active",
  retired: {},
};

export interface ThemePickerProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  copy?: Partial<ThemePickerCopy>;
}

const sideOf = (theme: ThemeOption): Appearance => (theme.dark ? "dark" : "light");

interface Card {
  key: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  /** The side a choice is filed under; `null` files it under the theme's own side and wears it. */
  side: Appearance | null;
  value: string;
  options: ThemeOption[];
  active: boolean;
}

/**
 * The theme choice, laid out as GitHub's Settings → Appearance.
 *
 * **Theme mode** is a select: *Sync with system* lets the OS pick the side and draws two cards, a
 * light theme and a dark theme; *Single theme* lets the user pick and draws one card, where choosing
 * a theme wears its side. Each card shows a large {@link ThemePreview} of its choice, the theme's
 * name, and a row of round swatches — a radio group, one swatch per theme on offer, each painted by
 * that theme's own tokens. The card on screen carries *Active*.
 *
 * It offers what the provider's `themes` lists and obeys the tenant's policy: a withheld or pinned
 * theme axis draws no cards, a withheld or pinned appearance draws no mode control and only the side
 * it resolves to. With neither offered it renders nothing.
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
  const id = React.useId();
  const modes = React.useMemo(
    () =>
      createListCollection({
        items: [
          { value: "sync", label: c.sync },
          { value: "single", label: c.single },
        ],
      }),
    [c.sync, c.single],
  );

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

  const cards: Card[] = sync
    ? [
        {
          key: "light",
          title: c.day,
          description: c.dayDescription,
          icon: <SunIcon />,
          side: "light",
          value: selectedFor("light"),
          options: onSide("light"),
          active: resolvedAppearance === "light",
        },
        {
          key: "dark",
          title: c.night,
          description: c.nightDescription,
          icon: <MoonIcon />,
          side: "dark",
          value: selectedFor("dark"),
          options: onSide("dark"),
          active: resolvedAppearance === "dark",
        },
      ]
    : [
        {
          key: "single",
          title: c.theme,
          icon: <PaletteIcon />,
          // A side the user cannot leave offers only its own themes: choosing one of the other side
          // would file a theme the pinned appearance never wears.
          side: modeOffered ? null : resolvedAppearance,
          value: resolvedTheme,
          options: modeOffered ? themes : onSide(resolvedAppearance),
          active: false,
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
    <div className={cn("@container flex flex-col gap-5", className)} {...rest} data-slot={slot ?? "theme-picker"}>
      {modeOffered ? (
        <Select
          className="flex flex-col gap-2"
          collection={modes}
          onValueChange={(d) => setAppearance(d.value[0] === "sync" ? "" : resolvedAppearance)}
          value={[sync ? "sync" : "single"]}
        >
          <ArkSelect.Label className="font-medium text-sm">{c.mode}</ArkSelect.Label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <SelectTrigger className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <p className="text-muted-foreground text-sm">{sync ? c.syncDescription : c.singleDescription}</p>
          </div>
          <SelectContent>
            {modes.items.map((item) => (
              <SelectItem item={item} key={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {themesOffered ? (
        <div className="grid items-start gap-4 @xl:grid-cols-2">
          {cards.map((card) => {
            const titleId = `${id}-${card.key}`;
            const chosen = themes.find((t) => t.value === card.value);
            return (
              <section
                aria-labelledby={titleId}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-box border bg-card text-card-foreground",
                  card.active && "border-primary",
                  cards.length === 1 && "@xl:col-span-2 @xl:max-w-md",
                )}
                data-active={card.active || undefined}
                data-slot="theme-picker-card"
                key={card.key}
              >
                <header
                  className={cn(
                    "flex items-center gap-2 border-b px-4 py-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                    card.active && "border-primary bg-primary/10",
                  )}
                >
                  {card.icon}
                  <h3 className="min-w-0 font-semibold text-sm" id={titleId}>
                    {card.title}
                  </h3>
                  {card.active ? (
                    <Badge className="ms-auto" size="sm" variant="info">
                      {c.active}
                    </Badge>
                  ) : null}
                </header>
                <div className="flex flex-col gap-3 p-4">
                  {card.description ? <p className="text-muted-foreground text-sm">{card.description}</p> : null}
                  <ThemePreview appearance={chosen ? sideOf(chosen) : (card.side ?? undefined)} theme={card.value} />
                  <p className="min-w-0 text-pretty break-words font-medium text-sm" data-slot="theme-picker-name">
                    {chosen?.label ?? card.value}
                  </p>
                  <ArkRadioGroup.Root
                    className="flex flex-wrap gap-2"
                    ids={{ label: titleId }}
                    onValueChange={(d) => d.value && choose(d.value, card.side)}
                    orientation="horizontal"
                    value={card.value}
                  >
                    {card.options.map((theme) => (
                      <ThemeSwatch key={theme.value} theme={theme} />
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
function ThemeSwatch({ theme }: { theme: ThemeOption }) {
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
              appearance={sideOf(theme)}
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
