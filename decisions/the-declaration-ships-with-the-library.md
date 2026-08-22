# The declaration ships with the library

- **Status** live — 2026-08-18
- **Decided** The core's axes are declared as generated DATA — kind, options, labels, default,
  attribute, doc — emitted into `theme-data.json` and carried by the root barrel for every consumer
  of it. The barrel's size budget is rebaselined to the measurement rather than the declaration
  being trimmed to the old one.
- **Because** the resolution chain runs in a browser, so what it resolves against cannot stay at
  build time.
- **Reversed by** the tree-shaken consumer gauge starting to carry it, or the declaration growing
  with what a HOST installs rather than with what the library ships — either turns a fixed cost paid
  by the library into a variable one paid by a consumer.
- **Held by** `packages/ui/package.json`, `size-limit`; `packages/theme/src/index.test.ts`,
  "offers exactly the values it generated, so no list is typed twice";
  `packages/theme/src/index.test.ts`, "names a SOURCE for the axis whose options a tenant writes"

## The working

Four gauges, before and after, brotlied. "Before" is `fb8e5b5`, the commit before this line of work;
re-derive it with `git worktree add <dir> fb8e5b5 && pnpm install && pnpm --filter @kanzo-tech/ui
build && pnpm --filter @kanzo-tech/ui size`.

| gauge | before | after |
|---|---|---|
| root barrel (JS) | 41.54 kB | 42.12 kB |
| analytics subpath (JS) | 66.22 kB | 66.22 kB |
| one component (tree-shaken) | 1.08 kB | 1.08 kB |
| stylesheet | 24.16 kB | 24.16 kB |

So the whole cost is **+0.58 kB on one gauge**, and the generated JSON is most of it: minified and
brotlied on its own, `theme-data.json` goes 302 B → 648 B. The remainder is the chain itself — the
policy composition, `prefOptions`, and the panel asking whether an axis is still offered.

Three gauges did not move, and the one that matters to a consumer is among them: `Button` still
resolves to 1.08 kB and three of our modules. Nobody who imports a component pays for this. The
barrel gauge is what `packages/ui/package.json` calls a change detector for the library's total
size, and this is the change it detected.

Deleted in the same commits, and not counted as an offset because it is smaller than the noise:
`RADII` and `DENSITIES` in `Preferences.tsx`, and `DEFAULT_FONTS` / `DEFAULT_MONO_FONTS` in
`KanzoThemeProvider.tsx` — four hand-typed copies of tables that were already being shipped.

## The case that does not fit

Two axes carry no option list at all. `identity` and `paletteByAppearance` declare
`{ from: "identities" }` / `{ from: "palettes" }`, because their values are brands a CLIENT authored
after this package was built. That is what keeps this a fixed cost: a tenant publishing forty brands
adds forty entries to the document they already ship, and not one byte here.

## What this does not touch

Not the pre-hydration script, which is generated per host and carries its own copy of the same rows
— it has to, because it runs before any module is evaluated. Its budget is nobody's `size-limit`
entry today, and `packages/ui/src/theme/theme-script.test.ts` measures agreement, never bytes.
