# @kanzo-tech/theme

Design tokens for Kanzo products. **Colour is a tenant palette document; everything else is an
axis.**

- **Palette** — not an axis. Two seeds (brand + neutral) derived and measured once at onboarding,
  stored as data, compiled to one stylesheet. See below.
- **Radius** — `none` · `xs` · `sm` · `md` · `lg` (one `--radius` knob drives the scale).
- **Font** / **Mono font** — `--font-sans` / `--font-mono`.
- **Density** — the root font-size the whole `rem` scale resolves against.
- **Appearance** — `light` / `dark`, owned by the host (see below).

This package ships **no components** and no colour maths. It is CSS, the axis table, and the value
types. The derivation lives in [`@kanzo-tech/palette`](../palette), which this package depends on
as a **devDependency** — the generator and the tests use it, a browser never does.

## Colour: the palette document

A client's colour identity has to reach `--primary`, the surfaces, the charts, the graph and the
dashboards, so there is exactly one artefact all of them read:

```ts
import { derivePalette, compile } from "@kanzo-tech/palette";

const doc = derivePalette({ id: "acme", label: "Acme", brand: "#7f22fe", neutral: "#6b7280" });
const css = compile(doc); // :root { … } .dark { … } — both modes, every token, ~4 KB
```

`derivePalette` grows six ramps (the client's brand and neutral, plus Kanzo's four fixed status
families) in both modes, spins a categorical set off the brand hue, resolves the role table, and
writes down everything that did not go exactly as asked in `doc.record`. The gate policy is
**adjust and publish** — never accept-and-warn, never refuse. Adding a client touches no code and
needs no deploy: the server looks the document up at request time and inlines `compile(doc)` as a
static `<style>` in `<head>`, so the colour maths is done before a byte is sent.

There is no colour axis. `data-base`, `data-accent`, `data-palette` and `data-chart-scheme` were
four ways to express *part* of a palette at runtime; a document expresses all of it at once.

**The default tenant is not a special case.** `palettes/kanzo.json` is a tenant whose document
happens to be committed, derived from `PALETTE_SEEDS.kanzo` by exactly the code a client's goes
through, and `tokens.css`'s colour half is that document compiled. `PALETTE_SEEDS` also carries
four borrowed identities — Dracula, Nord, Catppuccin Latte and Mocha — as seed pairs for the docs
showcase, which puts each authored original beside its derived result.

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
(`@kanzo-tech/theme/tokens.css`, `/themes.css`, `/palettes/kanzo.json`) are available for tooling.

The four non-colour axis tables are exported from the JS entry as `themeData` — import that,
**not** `@kanzo-tech/theme/theme-data.json`. A raw JSON subpath import is an ESM JSON import at
runtime, which Node rejects without `with { type: "json" }`, and Rollup strips that attribute
when bundling. The tables a *derivation* reads are not here: they are inputs to colour maths that
runs once at onboarding, and they live with it in `@kanzo-tech/palette`.

`CHART_SLOTS` is here rather than with the derivation because it is a fact about the **sheet** —
how many `--chart-*` properties it declares — and a chart resolving them off the cascade runs in a
browser, where the derivation deliberately cannot be reached. `@kanzo-tech/palette` declares the
same number, because it is what emits the properties; `src/boundary.test.ts` counts the
declarations in the shipped `tokens.css` and holds both against it, so neither copy is trusted.

`themes.css`, `theme-data.json`, `palettes/kanzo.json` and `tokens.css`'s colour half are all
generated — **edit the generators (`scripts/gen-theme.mjs`, `scripts/gen-palette.mjs`), not the
output**. `pnpm gen` builds `@kanzo-tech/palette` first and then runs both in order; CI
regenerates and fails on any diff.
