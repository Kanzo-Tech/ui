# @kanzo-tech/theme

The themes, and the preferences a person layers over them. **A theme is one flat block of CSS, and it carries
one mode.**

Four families ship, each a light theme and a dark one — eight themes:

| Family | Day | Night |
|---|---|---|
| `kanzo` — the default, from the kanzo.tech brand | `kanzo` | `kanzo-dark` |
| `catppuccin` | `catppuccin-latte` | `catppuccin-mocha` |
| `lofi` | `lofi` | `lofi-dark` |
| `nord` | `nord` | `nord-dark` |

A user picks a light theme and a dark theme, and which side to wear — GitHub's
Appearance model, drawn by `<Preferences />` in `@kanzo-tech/ui`. A product ships its own families beside
or instead of these.

- **Theme** — `packages/theme/themes/<name>.css`, hand-written source. Its colours, its three radii
  and the other shape knobs, optionally its faces (`--font-sans`, `--font-heading`, `--font-mono`;
  Geist and Geist Mono when it names none), and its own `color-scheme`. Selected with `data-theme`.
  Radius and typography are the theme's: no preference overrides them.
- **Appearance** — `light` / `dark`. It starts at the OS's `prefers-color-scheme` while nothing is
  stored; once the person picks, the pick wins. It chooses *which theme* is worn, because a theme is
  a side.
- **Density** — the root font-size the whole `rem` scale resolves against, as a percentage of the
  browser's own (`87.5%` · `100%` · `112.5%`). Always the person's: a tenant may start it elsewhere
  and may not pin it.

This package ships **no components**. It is CSS, the catalogue and the declared axes as data, the
contrast floors, and the authoring-time colour helpers the theme generator uses.

## The catalogue as data

```ts
import { defaultThemePair, themeFamilies, themeIndex } from "@kanzo-tech/theme";

themeIndex[0]; // { value: "kanzo", label: "Kanzo", dark: false, family: "kanzo" } — a ThemeOption
themeFamilies(themeIndex); // [{ family: "kanzo", light, dark }, …]
defaultThemePair(themeIndex); // { light: "kanzo", dark: "kanzo-dark" }
```

`themeIndex` is generated from the `themes/` directory — each file's `color-scheme` and its
`@family` / `@label` header — so adding a theme is adding a file. It is the default `themes` of
`KanzoThemeProvider`, and `defaultThemePair` is the default `defaultTheme` of both the provider and
`themeScript`.

## A theme

```css
/* packages/theme/themes/acme.css */
/* @family acme
   @label Acme */
[data-theme="acme"] {
  color-scheme: light;
  --background: #fbfcfd;  --foreground: #10151c;
  --primary: #1f6feb;     --primary-foreground: #ffffff;
  /* …the rest of the colours, then the rest of the shape knobs… */
  --radius-box: 0.75rem;  --radius-field: 0.5rem;  --radius-selector: 0.25rem;
  --stroke: 1px;          --relief: 0;
}
```

That is the whole mechanism: a block somebody writes, an `@import` in `themes.css`, and an attribute
on `<html>`. The header names the family the theme belongs to and the label a picker shows;
`scripts/gen-theme.mjs` refuses a family without exactly one light and one dark theme, and
`themes.test.ts` holds every theme to the floors `CONTRAST_PAIRS` lists — text at 4.5:1, borders,
the focus ring, the brand fill and chart marks at 3:1, and the eight `--syntax-*` inks on the page and
on the editor's active line. `auditContrast(resolve)` runs the same list over a theme of your own.
Adding a client touches no code and needs no deploy.

**What a theme writes:** the twenty-one colours (surfaces and ink, three brand fills with their inks,
four status fills with `-content`, `--border`, `--ring`), the names the components read with no
fallback (`--input`, `--field`, `--faint`, the four status `-foreground`s), the eight syntax inks
(`--syntax-keyword`, `-string`, `-number`, `-function`, `-variable`, `-property`, `-type`,
`-annotation`), the shape knobs, and optionally `--popover` and a categorical set (`--chart-1..8`).
The [theme generator](https://kanzo-tech.github.io/ui/theme-generator) writes all of it as a light and
dark pair.

**Twenty-one carry a value; everything else uses one.** `--card-foreground`, the sidebar tokens and
`--popover` are *uses*, bridged once in `tokens.css` through `@theme inline` and never re-declared —
which is also what makes a scoped `<div data-theme="…">` resolve correctly, since a custom property
declared in `:root` would inherit already substituted.

**Light and dark are two themes.** There is no second block and no `.dark` that flips a token; the
class survives only as the selector for the `dark:` variant at the call sites that still ask for one.

**There is no derivation and there are no step tokens.** A tint is a percentage on the role,
computed where it is used — `bg-destructive/7`, or `color-mix(in oklab, var(--destructive) 7%,
transparent)` where no utility reaches. The author answers for AA, and guards over the shipped themes
are what catch a mistake.

## How the preferences work

Each is an attribute **on `<html>`**: `data-theme` for the theme worn on the current side, `.dark` for
the side, and `data-font-size` for density. Change one and every component re-skins, with no
per-component work. `CORE_PREFS` declares the three, and it is the only list.

**The attributes must be on `<html>`, not a wrapper element.** Ark UI's overlays — Dialog,
Popover, Menu, Select, Tooltip, Toast, HoverCard, Command — portal into `document.body`, outside
any wrapper you render, so tokens set on a wrapper never reach them.
Density is stricter still: it sets the root font-size, and every size in the system is `rem`.

Writing them is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`:

```tsx
import { KanzoThemeProvider } from "@kanzo-tech/ui";

<KanzoThemeProvider defaults={{ density: "compact" }}>
  {children}
</KanzoThemeProvider>;
```

Read or change the live preferences with `useKanzoTheme()`, or drop in the ready-made
`<Preferences />` panel. Both come from `@kanzo-tech/ui`.

## Dark mode

Not owned here. `.dark` on `<html>` says which side is worn: the provider writes the theme chosen for
that side to `data-theme`, and the `dark:` variant keys off the class. If you already run a theme
manager that writes the class, turn its writer off — the provider is the one owner of `.dark`.

## SSR

Server-render the preferences with `themeScript()` from `@kanzo-tech/ui`, which writes the
attributes before first paint so there is no flash of the wrong theme. Pair it with
`cookieStorageAdapter()` so the server can read the same source from the request cookie:

```tsx
import { themeScript, cookieStorageAdapter } from "@kanzo-tech/ui";

<head><script dangerouslySetInnerHTML={{ __html: themeScript({ defaultTheme, policy }) }} /></head>
<KanzoThemeProvider defaultTheme={defaultTheme} policy={policy} storage={cookieStorageAdapter()}>
  {children}
</KanzoThemeProvider>
```

Give the script the **same** `defaultTheme` pair and `policy` as the provider — both are optional, but
a mismatch is a flash of one theme followed by another, and a hydration mismatch in any control that
renders from the resolved theme. A white-label lock is
`policy = { theme: { themeByAppearance: { hidden: true } } }` with the brand as `defaultTheme`.

## What's in the package

The Tailwind entry ships with `@kanzo-tech/ui` (`@import "@kanzo-tech/ui/tailwind.css"`), which
already pulls in this package's `tokens.css` + `themes.css`. Subpath exports
(`@kanzo-tech/theme/tokens.css`, `/themes.css`, `/themes/<name>.css`) are available for tooling —
the last one so a consumer can import a subset of the catalogue instead of all of it.

The non-colour axis tables — and the DECLARATION of every axis, `CORE_PREFS`, generated beside
them — are exported from the JS entry as `themeData` / `CORE_PREFS`. Import those, **not**
`@kanzo-tech/theme/theme-data.json`. A raw JSON subpath import is an ESM JSON import at
runtime, which Node rejects without `with { type: "json" }`, and Rollup strips that attribute
when bundling. `themeIndex` is the catalogue, read off the `themes/` directory by the generator,
so adding a theme is adding a file and nothing lists them twice.

`CHART_SLOTS` is a fact about the **sheet** — how many `--chart-*` properties a theme publishes —
and a chart resolving them off the cascade runs in a browser. It is checked against what actually
ships rather than trusted: `packages/ui/src/lib/token-color.test.ts` reads every theme file and
fails on one that declares a partial set.

`themes.css` and `theme-data.json` are generated — **edit `scripts/gen-theme.mjs`, not those two.**
`pnpm gen` runs it; CI regenerates and fails on any diff.

**`tokens.css` and `themes/*.css` are NOT generated.** They are hand-written source, and a guard that
regenerated them would have nothing to regenerate them from.
