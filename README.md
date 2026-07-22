# kanzo-ui

Kanzo's shared **design system** — a reference-grade UI surface built on **Ark UI**
(behaviour) + **Tailwind v4 + tailwind-variants** (appearance) + design tokens, adopted
from [Shark UI](https://shark.vini.one). Extracted into reusable packages so **keasy**,
**fossil (rmlext)** and **metadata-form** share the same primitives.

## What lives here (and what does NOT)

This repo is **only** the design system. Admission rule:

> _"Would this component make sense in a product that knows nothing about
> RDF / SHACL / fossil / graphs?"_ — if it knows about IRIs, shapes, LSP or the
> graph, it is **domain** and belongs with its product, not here.

Layering (dependency direction, never reversed):

```
apps  →  domain libs  →  @kanzo-tech/ui + @kanzo-tech/theme  →  Ark UI + Tailwind
```

## Packages

| Package | Purpose |
|---|---|
| `@kanzo-tech/theme` | Design tokens, the theme axis table and value types. No components — theming is `data-*` attributes on `<html>`: base colour · accent · radius · font · density · light/dark. |
| `@kanzo-tech/ui` | Level 1 primitives (Ark + tailwind-variants, flat compound API) + Level 2 domain-free shells (Sidebar, TopBar, StatusBar, WorkspaceLayout / Resizable, CommandPalette, EditorShell) + the `Preferences` theme panel. |

Domain code stays out: the metadata-form **form-system** ships as its own domain
package; fossil's **editor/viewer** stay in `rmlext/`; the **rudof engine** stays in
`rudof-fork` (`@kanzo-tech/rudof-wasm`).

## Develop

```bash
pnpm install
pnpm build       # builds every package (dist + .d.ts)
pnpm typecheck
pnpm test
pnpm lint
pnpm changeset   # record a version bump before merging
```

The playground (`playground/`) is a throwaway gallery that exercises every component;
run its dev server to review changes visually.

## Consuming apps

Import the one compiled stylesheet at the root and wrap your app in `<KanzoThemeProvider>`.
It writes the theme axes as `data-*` attributes on `<html>` — which is where they have to be,
because Ark's overlays (Dialog, Popover, Menu, Select, Tooltip…) portal to `document.body`,
outside any wrapper element:

```tsx
import "@kanzo-tech/ui/styles.css";
import { KanzoThemeProvider } from "@kanzo-tech/ui";

export function Root({ children }) {
  return <KanzoThemeProvider defaults={{ accent: "blue" }}>{children}</KanzoThemeProvider>;
}
```

Drop in `<Preferences />` for a live theme editor (base · accent · radius · font · density ·
light/dark), or drive the axes yourself via `useKanzoTheme()`.

Dark mode belongs to the host: pass your theme manager in as `appearance={{ resolvedTheme,
setTheme }}` (the next-themes shape), or omit it and the provider toggles `.dark` itself. For
SSR, render `themeScript()` in `<head>` and pair it with `cookieStorageAdapter()` so the server
reads the same source — that is what prevents a flash of the wrong theme.

Components that need CodeMirror (`EditorShell`, `GhostEditor`) live on the `@kanzo-tech/ui/editor`
subpath, and the TanStack `DataTable` on `@kanzo-tech/ui/table`, so the base bundle never pays
for those optional peers.

Vite consumers of `@kanzo-tech/rudof-wasm` (via a domain package) must keep the wasm
out of dep-optimization: `optimizeDeps: { exclude: ["@kanzo-tech/rudof-wasm"] }`.
