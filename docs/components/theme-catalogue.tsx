"use client";

import { themeFamilies, type ThemeFamily } from "@kanzo-tech/theme";
import { Button, ThemePreview, useKanzoTheme } from "@kanzo-tech/ui";
import { CheckIcon, MoonIcon, PencilIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/**
 * The catalogue as families — daisyUI's theme page, one card per family rather than per theme.
 *
 * A family is the pair a user wears by day and by night, so a card shows one side at a time and a
 * toggle inside it flips to the other: the question a reader is asking is "do I want this", and the
 * two halves of one answer belong on one card. Each preview is `ThemePreview` — the same scoped
 * miniature `ThemePicker` draws — so a card is the theme, not a picture of it.
 *
 * **Wear it** files the family under both sides at once (one tick, two writes — the provider
 * composes them) and leaves the appearance alone, so the side a reader picked stays picked.
 * **Edit** opens the generator on the pair.
 */
export function ThemeCatalogue() {
  const { themes, themeByAppearance, appearance, defaultThemeFor, setTheme } = useKanzoTheme();
  const families = themeFamilies(themes);
  const wornOn = (side: "light" | "dark") => themeByAppearance[side] || defaultThemeFor(side);
  const worn = (f: ThemeFamily) => wornOn("light") === f.light?.value && wornOn("dark") === f.dark?.value;

  const wear = (f: ThemeFamily) => {
    if (f.light) setTheme(f.light.value, { appearance: "light" });
    if (f.dark) setTheme(f.dark.value, { appearance: "dark" });
  };

  return (
    <div className="not-prose grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-5">
      {families.map((family) => (
        <FamilyCard
          family={family}
          initialSide={appearance}
          key={family.family}
          onWear={() => wear(family)}
          worn={worn(family)}
        />
      ))}
    </div>
  );
}

function FamilyCard({
  family,
  initialSide,
  onWear,
  worn,
}: {
  family: ThemeFamily;
  initialSide: "light" | "dark";
  onWear: () => void;
  worn: boolean;
}) {
  const [side, setSide] = React.useState<"light" | "dark">(
    family[initialSide] ? initialSide : family.light ? "light" : "dark",
  );
  const theme = family[side];
  if (!theme) return null;

  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-box border border-border bg-card p-3">
      <ThemePreview theme={theme.value} />
      <figcaption className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{theme.label}</span>
          {/* The brand fills, so a family scans as a colour before it is read. Outside the preview,
              so the row wears its theme by attribute. */}
          <span aria-hidden className="flex shrink-0 items-center gap-1" data-theme={theme.value}>
            {(["primary", "secondary", "accent"] as const).map((token) => (
              <span
                className="size-2.5 rounded-full ring-1 ring-border"
                key={token}
                style={{ background: `var(--${token})` }}
              />
            ))}
          </span>
          <div className="ms-auto flex items-center gap-0.5 rounded-field border border-border p-0.5">
            {(["light", "dark"] as const).map((option) => {
              const Icon = option === "light" ? SunIcon : MoonIcon;
              return (
                <Button
                  aria-label={family[option]?.label ?? option}
                  aria-pressed={side === option}
                  disabled={!family[option]}
                  key={option}
                  onClick={() => setSide(option)}
                  size="icon-sm"
                  variant={side === option ? "secondary" : "ghost"}
                >
                  <Icon />
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs">{family.family}</span>
          <Button
            className="ms-auto"
            disabled={worn}
            onClick={onWear}
            size="sm"
            variant={worn ? "secondary" : "outline"}
          >
            {worn ? <CheckIcon /> : null}
            {worn ? "Worn" : "Wear it"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/theme-generator?from=${encodeURIComponent(family.family)}`}>
              <PencilIcon />
              Edit
            </Link>
          </Button>
        </div>
      </figcaption>
    </figure>
  );
}

export default ThemeCatalogue;
