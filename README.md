# kanzo-ui

Kanzo's shared **design system**: **Ark UI** for behaviour, **Tailwind v4 + tailwind-variants** for
appearance, and design tokens between them. The component set is adopted from
[Shark UI](https://shark.vini.one) and re-branded to the Kanzo tokens. Extracted into packages so
**keasy**, **fossil (rmlext)** and **metadata-form** share one surface.

Agents and new contributors start at [`CLAUDE.md`](CLAUDE.md). It names everything else.

## Packages

| Package | What it is |
|---|---|
| `@kanzo-tech/theme` | The theme catalogue — one flat block of CSS per theme, hand-written — plus the non-colour axes a user layers over them and the value types. No React, no components, no colour maths. |

| `@kanzo-tech/ui` | The components, the compiled stylesheet, and the theming runtime. |

## What lives here, and what does not

This repository is **only** the design system. The admission test: *would this make sense in a
product that knows nothing about RDF, SHACL, fossil or graphs?* If it knows about IRIs, shapes, an
LSP or the graph, it is domain code and belongs with its product.

```
apps  →  domain libs  →  @kanzo-tech/ui + @kanzo-tech/theme  →  Ark UI + Tailwind
```

The dependency direction is never reversed. The docs site's Philosophy page (`/docs/philosophy`)
has the full admission rules and the ladder you walk before adding anything; `CONVENTIONS.md` has how a file is written; `decisions/` has why
each rule holds and what would reverse it.

## Consuming

Import the one compiled stylesheet at the root and wrap your app in `KanzoThemeProvider`. It writes
the theme axes as `data-*` attributes on `<html>` — which is where they have to be, because Ark's
overlays portal to `document.body`, outside any wrapper element, and density sets the root font-size
the whole `rem` scale resolves against.

```tsx
import "@kanzo-tech/ui/styles.css";
import { KanzoThemeProvider } from "@kanzo-tech/ui";

export function Root({ children }) {
  return <KanzoThemeProvider>{children}</KanzoThemeProvider>;
}
```

Drop in `<Preferences />` for a live theme editor, or drive the axes yourself with `useKanzoTheme()`.
Dark mode belongs to the host: pass your theme manager in as `appearance={{ resolvedTheme, setTheme }}`
(the next-themes shape), or omit it and the provider toggles `.dark` itself. For SSR, render
`themeScript()` in `<head>` and pair it with `cookieStorageAdapter()` so the server reads the same
source — that is what prevents a flash of the wrong theme.

**Colour is not an axis.** A client's identity is a palette document derived once at onboarding, and
everything downstream — the primary colour, the charts, the dashboards — comes from that one
artefact. See `packages/palette/README.md`.

**Optional peers live on subpaths.** Anything needing CodeMirror, TanStack Table or the
DuckDB/Mosaic analytics stack is on `@kanzo-tech/ui/editor`, `/table` or `/analytics`, so the base
bundle never pays for a peer you did not install.

## Developing

```bash
pnpm install
pnpm build       # first: packages typecheck against each other's emitted .d.ts
pnpm typecheck
pnpm test
pnpm lint
pnpm changeset   # record a version bump before merging
```

The docs site is where components are reviewed visually — `pnpm --filter @kanzo-tech/docs dev`, then
http://localhost:3100. A Next.js App Router app on fumadocs, mirroring Shark's docs stack, with each
example's source read off disk at build time so the code shown cannot drift from the component
rendered above it.

It is also the library's **RSC fixture**, and that is the load-bearing part: every documented
component is prerendered inside a real server tree in CI. No Vite-based harness can verify that,
because Vite ignores `"use client"` entirely — which is how a build that stripped every directive
went unnoticed. The fixture found a broken `Object.assign` compound export on its first run.
