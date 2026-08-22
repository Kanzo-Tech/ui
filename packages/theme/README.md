# @kanzo-tech/theme

The theme catalogue and the axes a user layers over it. **A theme is one flat block of CSS, and it
carries one mode.**

- **Theme** — `packages/theme/themes/<name>.css`, hand-written source. Twenty-one authored colours,
  the shape knobs, the font stacks and its own `color-scheme`. Selected with `data-theme`.
- **Radius** — `none` · `xs` · `sm` · `md` · `lg`, a user preference over the theme's own three
  radius knobs.
- **Font** / **Mono font** — `--font-sans` / `--font-heading` / `--font-mono`.
- **Density** — the root font-size the whole `rem` scale resolves against.
- **Appearance** — `light` / `dark`, and it chooses *which theme* is worn, because a theme is a side.

This package ships **no components** and no colour maths. It is CSS, the declared axes and the value
types.

## A theme

```css
/* packages/theme/themes/acme.css */
[data-theme="acme"] {
  color-scheme: light;
  --background: #fbfcfd;  --foreground: #10151c;
  --primary: #1f6feb;     --primary-foreground: #ffffff;
  /* …nineteen more, then the shape knobs and the fonts… */
  --radius-box: 0.75rem;  --radius-field: 0.5rem;  --radius-selector: 0.25rem;
  --stroke: 1px;          --depth: 0;
}
```

That is the whole mechanism: a block somebody writes, an `@import` in `themes.css`, and an attribute
on `<html>`. Adding a client touches no code and needs no deploy.

**Twenty-one carry a value; everything else uses one.** `--card-foreground`, the sidebar tokens and
`--popover` are *uses*, bridged once in `tokens.css` through `@theme inline` and never re-declared —
which is also what makes a scoped `<div data-theme="…">` resolve correctly, since a custom property
declared in `:root` would inherit already substituted.

**Light and dark are two themes.** There is no second block and no `.dark` that flips a token; the
class survives only as the selector for the `dark:` variant at the call sites that still ask for one.

**There is no derivation.** A `@kanzo-tech/palette` package used to take two seeds through thirteen
stages and publish 144 reference steps; components used eighteen of them, and all eighteen were
tints that `color-mix` now computes at the point of use. It is deleted. What that costs is a contrast
guarantee at authoring time — the author answers for AA, and a guard over the shipped themes is what
catches a mistake. See `decisions/a-theme-is-one-flat-block.md`.

## How the other axes work

Every axis is a `data-*` attribute **on `<html>`**, and the token values behind it live in
`themes.css`. Change an attribute and every component re-skins, with no per-component work.

| Axis | Attribute | Sets |
|---|---|---|
| radius | `data-radius` | `--radius` |
| font | `data-font` | `--font-sans` |
| monoFont | `data-mono-font` | `--font-mono` |
| density | `data-font-size` | the root font-size |

**The attributes must be on `<html>`, not a wrapper element.** Ark UI's overlays — Dialog,
Popover, Menu, Select, Tooltip, Toast, HoverCard, Command — portal into `document.body`, outside
any wrapper you render, so tokens set on a wrapper never reach them.
Density is stricter still: it sets the root font-size, and every size in the system is `rem`.

Writing them is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`:

```tsx
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import "@kanzo-tech/ui/styles.css"; // once, at the root

<KanzoThemeProvider defaults={{ radius: "md", density: "compact" }}>
  {children}
</KanzoThemeProvider>;
```

Read or change the live preferences with `useKanzoTheme()`, or drop in the ready-made
`<Preferences />` panel. Both come from `@kanzo-tech/ui`.

## Dark mode

Not owned here. The host toggles `.dark` on `<html>`, and the `.dark` block of the compiled
document keys off it. If you already run a theme manager, hand it to the provider:

```tsx
import { useTheme } from "next-themes";

const { resolvedTheme, setTheme } = useTheme();
<KanzoThemeProvider appearance={{ resolvedTheme, setTheme }}>{children}</KanzoThemeProvider>;
```

Omit the prop and the provider's built-in fallback toggles `.dark` itself.

## SSR

Server-render the preferences with `themeScript()` from `@kanzo-tech/ui`, which writes the
attributes before first paint so there is no flash of the wrong theme. Pair it with
`cookieStorageAdapter()` so the server can read the same source from the request cookie:

```tsx
import { themeScript, cookieStorageAdapter } from "@kanzo-tech/ui";

<head><script dangerouslySetInnerHTML={{ __html: themeScript() }} /></head>
<KanzoThemeProvider storage={cookieStorageAdapter()}>{children}</KanzoThemeProvider>
```

## What's in the package

The compiled styles ship with `@kanzo-tech/ui` (`import "@kanzo-tech/ui/styles.css"`), which
already pulls in this package's `tokens.css` + `themes.css`. Subpath exports
(`@kanzo-tech/theme/tokens.css`, `/themes.css`, `/themes/<name>.css`) are available for tooling —
the last one so a consumer can import a subset of the catalogue instead of all of it.

The non-colour axis tables — and the DECLARATION of every axis, `CORE_PREFS`, generated beside
them — are exported from the JS entry as `themeData` / `CORE_PREFS`. Import those, **not**
`@kanzo-tech/theme/theme-data.json`. A raw JSON subpath import is an ESM JSON import at
runtime, which Node rejects without `with { type: "json" }`, and Rollup strips that attribute
when bundling. `themeData.themes` is the catalogue, read off the `themes/` directory by the
generator, so adding a theme is adding a file and nothing lists them twice.

`CHART_SLOTS` is a fact about the **sheet** — how many `--chart-*` properties a theme publishes —
and a chart resolving them off the cascade runs in a browser. It is checked against what actually
ships rather than trusted: `packages/ui/src/lib/token-color.test.ts` reads every theme file and
fails on one that declares a partial set.

`themes.css` and `theme-data.json` are generated — **edit `scripts/gen-theme.mjs`, not those two.**
`pnpm gen` runs it; CI regenerates and fails on any diff.

**`tokens.css` and `themes/*.css` are NOT generated.** They are hand-written source, and a guard that
regenerated them would have nothing to regenerate them from. That is the whole shape of the change:
colour stopped being output.
