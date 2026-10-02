"use client";

import * as React from "react";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import type { Appearance, ThemeOption } from "@kanzo-tech/theme";
import { InfoIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Badge } from "../simples/badge.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { KanzoTheme } from "../theme/KanzoTheme.js";
import { useKanzoTheme } from "../theme/theme-context.js";
import { themeRetiredCopy, type ThemeRetiredCopy } from "./theme-notice.js";
import { ThemePreview } from "./ThemePreview.js";

/** Every string the picker authors. The theme labels are the tenant's and are never reworded. */
export interface ThemePickerCopy {
  /** The accessible name of the two cards, which together are the Light · Dark choice. */
  appearance: string;
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
 * The theme choice: two cards, a light theme and a dark theme, and **the card is the selector**.
 *
 * The cards are one radio group, *Appearance*: choosing a card wears its side, and the worn card is
 * checked — a primary border and *Active*. Each card is a large {@link ThemePreview} of its side's
 * theme, the theme's name, and a row of round swatches, one per theme of that side, painted by the
 * theme's own tokens. Pointing at a swatch (or focusing it) previews that theme inside the card only;
 * clicking it files the theme under the card's side and wears that side.
 *
 * It offers what the provider's `themes` lists and obeys the tenant's policy: a withheld or pinned
 * appearance draws only the worn side's card, a withheld or pinned theme draws the cards without
 * swatches. With neither offered it renders nothing.
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
  const commit = (side: Appearance, theme: string) => {
    setTheme(theme, { appearance: side });
    if (side !== appearance) setAppearance(side);
  };
  const retired = retiredTheme ? themeRetiredCopy(c.retired, retiredTheme) : null;

  const cards = (appearanceOffered ? SIDES : [appearance]).map((side) => (
    <ThemeCard
      active={side === appearance}
      copy={c}
      key={side}
      onCommit={(theme) => commit(side, theme)}
      selectable={appearanceOffered}
      side={side}
      themes={themesOffered ? onSide(side) : null}
      titleId={`${id}-${side}`}
      value={selectedFor(side)}
    />
  ));

  return (
    <div className={cn("@container flex flex-col gap-5", className)} {...rest} data-slot={slot ?? "theme-picker"}>
      {appearanceOffered ? (
        <ArkRadioGroup.Root
          className="grid items-start gap-4 @xl:grid-cols-2"
          onValueChange={(d) => d.value && setAppearance(d.value as Appearance)}
          value={appearance}
        >
          <ArkRadioGroup.Label className="sr-only">{c.appearance}</ArkRadioGroup.Label>
          {cards}
        </ArkRadioGroup.Root>
      ) : (
        <div className="grid">{cards}</div>
      )}

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

interface ThemeCardProps {
  side: Appearance;
  /** The theme committed for this side. */
  value: string;
  /** This side's themes, or `null` where the tenant withholds the theme. */
  themes: readonly ThemeOption[] | null;
  active: boolean;
  /** Whether the card is a radio of the *Appearance* group — false where the tenant pins the side. */
  selectable: boolean;
  titleId: string;
  copy: ThemePickerCopy;
  onCommit: (theme: string) => void;
}

/**
 * One side's card. Its radio is the header, stretched over the whole card by an `::after`, so a click
 * anywhere wears the side; the swatch row sits above that layer, so a swatch is never also a click on
 * the card, and no control is nested inside another.
 */
function ThemeCard({ side, value, themes, active, selectable, titleId, copy, onCommit }: ThemeCardProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const shown = preview ?? value;
  const label = themes?.find((t) => t.value === shown)?.label ?? shown;
  const title = side === "light" ? copy.day : copy.night;
  const icon = side === "light" ? <SunIcon /> : <MoonIcon />;

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-box border bg-card text-card-foreground outline-ring outline-offset-2 has-data-focus-visible:outline-2",
        active && "border-primary",
      )}
      data-active={active || undefined}
      data-slot="theme-picker-card"
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          active && "border-primary bg-primary/10",
        )}
      >
        {selectable ? (
          <ArkRadioGroup.Item
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 after:absolute after:inset-0"
            data-slot="theme-picker-card-radio"
            value={side}
          >
            {icon}
            <ArkRadioGroup.ItemText className="min-w-0 font-semibold text-sm">
              <span id={titleId}>{title}</span>
            </ArkRadioGroup.ItemText>
            <ArkRadioGroup.ItemHiddenInput />
          </ArkRadioGroup.Item>
        ) : (
          <>
            {icon}
            <h3 className="min-w-0 flex-1 font-semibold text-sm" id={titleId}>
              {title}
            </h3>
          </>
        )}
        {active ? (
          <Badge aria-hidden={selectable || undefined} size="sm" variant="info">
            {copy.active}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-sm">{side === "light" ? copy.dayDescription : copy.nightDescription}</p>
        <ThemePreview appearance={side} theme={shown} />
        <p className="min-w-0 text-pretty break-words font-medium text-sm" data-slot="theme-picker-name">
          {label}
        </p>
        {themes ? (
          <ThemeSwatches
            labelledBy={titleId}
            onCommit={onCommit}
            onPreview={setPreview}
            side={side}
            themes={themes}
            value={value}
          />
        ) : null}
      </div>
    </div>
  );
}

interface ThemeSwatchesProps {
  side: Appearance;
  themes: readonly ThemeOption[];
  value: string;
  labelledBy: string;
  onCommit: (theme: string) => void;
  onPreview: (theme: string | null) => void;
}

const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * A side's themes as round swatches: a radio group with MANUAL activation, as the WAI-ARIA toolbar
 * pattern runs its radios. Arrow keys move focus — and the card's preview with it — without
 * choosing; Enter or Space chooses; Escape puts the preview back. A radio that chose on arrow would
 * repaint the page on every key press. One swatch is in the tab order: the focused one, else the
 * chosen one.
 */
function ThemeSwatches({ side, themes, value, labelledBy, onCommit, onPreview }: ThemeSwatchesProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = React.useState<number | null>(null);
  const tabbable = focused ?? Math.max(0, themes.findIndex((t) => t.value === value));

  // Escape is caught on `window`, ahead of the tooltip: an open tooltip closes on a capturing
  // `document` listener that stops the key there, so a handler on the row would never hear it.
  const focusedInside = focused !== null;
  React.useEffect(() => {
    if (!focusedInside) return;
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onPreview(null);
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [focusedInside, onPreview]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = STEP[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const n = themes.length;
    refs.current[(tabbable + step + n) % n]?.focus();
  };

  return (
    <div
      aria-labelledby={labelledBy}
      className="relative z-10 flex w-fit flex-wrap gap-2"
      data-slot="theme-picker-swatches"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setFocused(null);
        onPreview(null);
      }}
      onKeyDown={onKeyDown}
      onPointerLeave={() => onPreview(null)}
      role="radiogroup"
    >
      {themes.map((theme, i) => (
        <Tooltip key={theme.value}>
          <TooltipTrigger asChild>
            <button
              aria-checked={theme.value === value}
              aria-label={theme.label}
              className="cursor-pointer rounded-full p-0.5 ring-2 ring-transparent outline-ring outline-offset-2 transition-shadow hover:ring-border focus-visible:outline-2 aria-checked:ring-primary"
              data-slot="theme-picker-swatch"
              onClick={() => onCommit(theme.value)}
              onFocus={() => {
                setFocused(i);
                onPreview(theme.value);
              }}
              onPointerEnter={() => onPreview(theme.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              tabIndex={i === tabbable ? 0 : -1}
              type="button"
              value={theme.value}
            >
              <KanzoTheme
                aria-hidden
                appearance={side}
                className="block size-7 rounded-full border border-border bg-[linear-gradient(135deg,var(--background)_50%,var(--primary)_50%)]"
                theme={theme.value}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
