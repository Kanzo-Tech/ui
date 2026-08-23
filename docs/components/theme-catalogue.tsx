"use client";

import { themeIndex } from "@kanzo-tech/theme";
import { Button, useKanzoTheme } from "@kanzo-tech/ui";
import { CheckIcon, MoonIcon, PencilIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ThemeScreen } from "./theme-screen";

/**
 * One screen, every theme, at once — the catalogue seen rather than listed.
 *
 * The thing a list of theme names cannot tell you is what any of them are *like*. A row of swatches
 * is barely better: it is a claim about colours that says nothing about whether an interface built
 * from them holds together. So this draws the same arrangement the
 * [generator](/theme-generator) previews — imported rather than rebuilt — once per shipped theme,
 * and lets the comparison happen where comparisons actually happen, which is between two screens
 * and not between two palettes.
 *
 * **It was a showcase in an iframe and it is a documentation page now**, which is where daisyUI
 * keeps the same thing. A showcase claims the viewport because a shell judged inside a centred box
 * proves nothing; a catalogue is a grid of thumbnails and has no such claim, so the iframe was
 * buying nothing and costing the page's own scrolling, its search index and its links.
 *
 * ## Nothing here paints a theme; each tile *is* one
 *
 * A tile is a `[data-theme]` attribute on a `div`. That selector is an ordinary attribute selector
 * — it matches an element, not a document — so the theme's custom properties land on the tile and
 * inherit into everything inside it, and the bridge in `tokens.css` resolves each utility on the
 * element that uses it. Twenty-nine themes therefore cost twenty-nine attributes and no JavaScript:
 * no iframe per tile, no stylesheet swapping, no state. `color-scheme` rides along inside each
 * theme's own block, so a dark tile renders its scrollbars dark without being told.
 *
 * That is the same property the generator leans on, and it is worth stating twice because it is the
 * one thing that would break it. If the theme layer ever declared its colours on `:root` alone, a
 * custom property would resolve once on `<html>` and every tile here would paint the same theme.
 *
 * ## What it deliberately does not do
 *
 * **It does not let you edit.** Editing is the generator, and each tile links to it carrying its own
 * theme, so the two surfaces meet rather than overlap.
 *
 * **It does not rank them.** The order is the catalogue's, with light and dark separated only
 * because putting a light tile beside a dark one at this size reads as a rendering fault rather
 * than as a choice.
 */
export function ThemeCatalogue() {
  const { resolvedTheme, setAppearance, setTheme } = useKanzoTheme();
  const [side, setSide] = React.useState<"light" | "dark">("light");
  const themes = themeIndex.filter((t) => t.dark === (side === "dark"));

  // Two calls, for the reason `ThemeMenu`'s `choose` sets out at length: `setTheme` files a theme
  // under a side and does not move you to it, so wearing a dark tile from the light side stored a
  // preference and repainted nothing.
  const wear = (name: string, appearance: "light" | "dark") => {
    setTheme(name, { appearance });
    setAppearance(appearance);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* A theme is a mode, so the two sides are two sets of themes rather than a switch over one.
          This picks which set you are looking at; it does not convert anything. */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-field border border-border p-0.5">
          {(["light", "dark"] as const).map((option) => (
            <Button
              aria-pressed={side === option}
              key={option}
              onClick={() => setSide(option)}
              size="sm"
              variant={side === option ? "secondary" : "ghost"}
            >
              {option === "light" ? <SunIcon /> : <MoonIcon />}
              {option}
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground text-sm">
          {themes.length} {side} · {themeIndex.length} in the catalogue
        </span>
      </div>

      {/* Three across on a wide screen, not two. The reference's catalogue page is a grid of small
          cards — theme name, four glyphs — and it fits a dozen on a screen, because the job of a
          catalogue is *browsing*. Ours keeps the screen instead of the glyphs, which is the whole
          argument of this page, so the way to get closer to that job is a smaller tile rather than
          a poorer one: twenty-nine themes two per row is fifteen rows of scrolling. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {themes.map((theme) => (
          <Tile
            key={theme.name}
            name={theme.name}
            onWear={() => wear(theme.name, side)}
            worn={resolvedTheme === theme.name}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One theme, wearing the screen.
 *
 * The caption sits **outside** the themed element on purpose. A label painted in the theme it
 * describes is unreadable exactly when you most need it — when the theme is broken — and this page
 * is one of the few places where reading a theme's name while doubting its colours is the point.
 *
 * "Wear it" is new, and it is what a catalogue inside the documentation can do that one inside an
 * iframe could not: the site itself is themed by the same attribute, so pressing it puts the tile's
 * theme on `<html>` and the page you are reading becomes the specimen. The side comes with it, and
 * that takes two calls — `wear` above says why.
 */
function Tile({ name, onWear, worn }: { name: string; onWear: () => void; worn: boolean }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-center gap-2">
        <span className="truncate font-mono text-muted-foreground text-xs">{name}</span>
        {/* The three brand fills, so a name can be scanned as a colour without reading the tile
            below it — the reference puts four glyphs on its card for exactly this. Outside the
            themed element, so each dot wears its own `data-theme`. */}
        <span aria-hidden className="flex shrink-0 items-center gap-1">
          {(["primary", "secondary", "accent"] as const).map((token) => (
            <span
              className="size-2.5 rounded-full ring-1 ring-border"
              data-theme={name}
              key={token}
              style={{ background: `var(--${token})` }}
            />
          ))}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <Button
          aria-pressed={worn}
          disabled={worn}
          onClick={onWear}
          size="sm"
          variant={worn ? "secondary" : "ghost"}
        >
          {worn ? <CheckIcon /> : null}
          {worn ? "Worn" : "Wear it"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/theme-generator?from=${encodeURIComponent(name)}`}>
            <PencilIcon />
            Edit
          </Link>
        </Button>
      </figcaption>
      {/* A window onto a product, not a region of this page that changed colour — hence the border
          and the crop. And a *thumbnail*: at full size one tile is 960px tall, so a catalogue of
          them shows one theme at a time, which is the opposite of what a catalogue is for. `zoom`
          shrinks layout rather than painting a smaller picture of it, so the borders, the type and
          the control heights all stay in proportion; a `transform: scale` would leave the box the
          size it was and the grid would still be reserving 960px per theme. */}
      <div className="h-[26rem] overflow-hidden rounded-box border border-border" data-theme={name}>
        {/* **No `zoom`, and losing it is the point.** It shrank the layout to 52%, so a tile showed
            54% of the screen with its type at half size — the real thing, made small, which is
            exactly what reads as a bad picture. At full size the screen responds to the tile
            instead: `ThemeScreen` is a container, so the fragments reflow for 355px and every
            control is at the size a reader would actually meet it. What it costs is how much you
            see — 38% of the screen rather than 54% — and that is the right thing to spend, because
            a tile is asking "does this theme work", not "what does this product do". */}
        <div className="h-full bg-background">
          <div className="p-4">
            <ThemeScreen />
          </div>
          {/* The crop ends wherever it ends, and a hard edge mid-card reads as a rendering fault.
              This says "there is more", in the tile's own background so it works on either side. */}
          <div
            aria-hidden
            className="pointer-events-none sticky bottom-0 h-16 w-full"
            style={{ background: "linear-gradient(to top, var(--background), transparent)" }}
          />
        </div>
      </div>
    </figure>
  );
}

export default ThemeCatalogue;
