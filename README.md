# kanzo-ui

Kanzo's shared **design system**: **Ark UI** for behaviour, **Tailwind v4 + tailwind-variants** for
appearance, and design tokens between them. The component set is adopted from
[Shark UI](https://shark.vini.one) and re-branded to the Kanzo tokens. Applications build their screens from it; **fossil** is the
backend its graph and charts read, and ships no UI of its own.

Agents and new contributors start at [`CLAUDE.md`](CLAUDE.md). It names everything else.

## Packages

| Package | What it is |
|---|---|
| `@kanzo-tech/theme` | The tokens and the theme files — one flat block of CSS per theme, hand-written — plus the non-colour axes a user layers over them and the value types. No React, no components, no colour maths. |
| `@kanzo-tech/ui` | The components, the Tailwind v4 entry, and the theming runtime. |
| `@kanzo-tech/mosaic` | The Mosaic coordinator, clauses and the page's one DuckDB-WASM `engine()`, without React. |
| `@kanzo-tech/ai` | The AI surfaces: transcript, composer, reasoning, tool calls, streamed fields. |
| `@kanzo-tech/graph` | A whole fossil corpus drawn with cosmos.gl inside the page's Mosaic crossfilter. |
| `@kanzo-tech/auth` | Keycloak sessions, role evaluation and an authenticated fetch. |
| `@kanzo-tech/navigation` | The unsaved-changes guard, with a `/next` adapter. |

## Services

The server half of a capability whose client half is a package, released under the same tag — see
[`services/`](services) and `/docs/design/services`.

| Service | What it is | Package |
|---|---|---|
| `services/auth` | Keycloak with the platform realm as code, and the module an application registers itself with. | `@kanzo-tech/auth` |
| `services/ai` | The LiteLLM gateway: a development compose, a team and key per tenant, and a module to deploy it. | `@kanzo-tech/llm` |

## What lives here, and what does not

`@kanzo-tech/ui` is **only** the design system. The admission test: *would this make sense in a
product that knows nothing about RDF, SHACL, fossil, graphs or auth?* What fails it and several
products still need is a sibling package above; the rest is domain code and belongs with its
product.

```
apps  →  domain libs  →  @kanzo-tech/ui + @kanzo-tech/theme  →  Ark UI + Tailwind
```

The dependency direction is never reversed. The docs site's Philosophy page (`/docs/philosophy`)
has the full admission rules and the ladder you walk before adding anything; the documentation site's **Conventions** page
(`docs/content/docs/(root)/conventions.mdx`) has how a file is written; `/docs/design` has why
each rule holds and what would reverse it.

## Consuming

Add the Tailwind v4 entries to your stylesheet and wrap your app in `KanzoThemeProvider`. It writes
the theme axes as `data-*` attributes on `<html>` — which is where they have to be, because Ark's
overlays portal to `document.body`, outside any wrapper element, and density sets the root font-size
the whole `rem` scale resolves against.

```css
@import "tailwindcss";
@import "@kanzo-tech/ui/tailwind.css";
@import "@kanzo-tech/ai/tailwind.css"; /* only with @kanzo-tech/ai */
```

```tsx
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

**Colour is a theme.** A client's identity is a theme file somebody writes once at onboarding, and
everything downstream — the primary colour, the charts, the graph — reads the tokens it declares.
See `/docs/onboarding`.

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
pnpm changeset   # release notes for a change a consumer can see; the tag decides the version
```

The docs site is where components are reviewed visually — `pnpm --filter @kanzo-tech/docs dev`, then
http://localhost:3100. A Next.js App Router app on fumadocs, mirroring Shark's docs stack, with each
example's source read off disk at build time so the code shown cannot drift from the component
rendered above it.

It is also the library's **RSC fixture**, and that is the load-bearing part: every documented
component is prerendered inside a real server tree in CI. No Vite-based harness can verify that,
because Vite ignores `"use client"` entirely. `pnpm verify` runs the whole gate, the docs build
included.
