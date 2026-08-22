"use client";

import { Button, ShellBody, ShellHeader, ShellMain, ShellRoot } from "@kanzo-tech/ui";
import { themeIndex } from "@kanzo-tech/theme";
import { MoonIcon, PencilIcon, SunIcon } from "lucide-react";
import * as React from "react";
import { ThemeScreen } from "../shared";

/**
 * One screen, every theme, at once.
 *
 * The thing a catalogue of themes cannot tell you is what any of them are *like*. A list of names
 * is a list of names; a row of swatches is a claim about colours that says nothing about whether an
 * interface built from them holds together. So this draws the same arrangement — the one the studio
 * previews, imported rather than rebuilt — once per shipped theme, and lets the comparison happen
 * where comparisons actually happen, which is between two screens and not between two palettes.
 *
 * ## Nothing here paints a theme; each tile *is* one
 *
 * A tile is a `[data-theme]` attribute on a `div`. That selector is an ordinary attribute selector
 * — it matches an element, not a document — so the theme's custom properties land on the tile and
 * inherit into everything inside it, and the bridge in `tokens.css` resolves each utility on the
 * element that uses it. Sixteen themes therefore cost sixteen attributes and no JavaScript: no
 * iframe per tile, no stylesheet swapping, no state.
 *
 * That is the same property the studio leans on, and it is worth stating twice because it is the
 * one thing that would break it. If the theme layer ever declared its colours on `:root` alone, a
 * custom property would resolve once on `<html>` and every tile here would paint the same theme.
 *
 * ## What it deliberately does not do
 *
 * **It does not let you edit.** Editing is the studio, and each tile links to it carrying its own
 * theme, so the two surfaces meet rather than overlap.
 *
 * **It does not rank them.** The order is the catalogue's, with light and dark separated only
 * because putting a light tile beside a dark one at this size reads as a rendering fault rather
 * than as a choice.
 */
export function ThemeGalleryShowcase() {
  const [side, setSide] = React.useState<"light" | "dark">("light");
  const themes = themeIndex.filter((t) => t.dark === (side === "dark"));

  return (
    <ShellRoot className="h-dvh">
      <ShellHeader className="flex flex-wrap items-center gap-x-6 gap-y-3 border-border border-b px-5 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">One screen, every theme</h1>
          <p className="text-muted-foreground text-xs leading-tight">
            The same arrangement the studio previews, drawn once per shipped theme. Each tile is a
            `data-theme` attribute and nothing else.
          </p>
        </div>

        {/* A theme is a mode, so the two sides are two sets of themes rather than a switch over
            one. This picks which set you are looking at; it does not convert anything. */}
        <div className="ms-auto flex items-center gap-1 rounded-field border border-border p-0.5">
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
      </ShellHeader>

      <ShellBody>
        <ShellMain className="overflow-y-auto bg-background p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {themes.map((theme) => (
              <Tile dark={theme.dark} key={theme.name} name={theme.name} />
            ))}
          </div>
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}

/**
 * One theme, wearing the screen.
 *
 * The caption sits **outside** the themed element on purpose. A label painted in the theme it
 * describes is unreadable exactly when you most need it — when the theme is broken — and this page
 * is one of the few places where reading a theme's name while doubting its colours is the point.
 */
function Tile({ dark, name }: { dark: boolean; name: string }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-center gap-2">
        <span className="truncate font-mono text-muted-foreground text-xs">{name}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <Button asChild size="sm" variant="ghost">
          <a href={`/view/showcases/theme-studio?from=${encodeURIComponent(name)}`}>
            <PencilIcon />
            Edit
          </a>
        </Button>
      </figcaption>
      {/* A window onto a product, not a region of this page that changed colour — hence the border
          and the crop. And a *thumbnail*: at full size one tile is 960px tall, so a gallery of them
          shows one theme at a time, which is the opposite of what a gallery is for. `zoom` shrinks
          layout rather than painting a smaller picture of it, so the borders, the type and the
          control heights all stay in proportion; a `transform: scale` would leave the box the size
          it was and the grid would still be reserving 960px per theme. */}
      <div
        className="h-[22rem] overflow-hidden rounded-box border border-border"
        data-theme={name}
        // From the catalogue, not from the name: the generator reads `color-scheme` out of each
        // theme file, and a theme is free to be dark without saying so in its name.
        style={{ colorScheme: dark ? "dark" : "light" }}
      >
        <div className="h-full bg-background" style={{ zoom: 0.6 }}>
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
