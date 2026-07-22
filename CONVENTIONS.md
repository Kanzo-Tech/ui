# Kanzo UI — conventions

The design system separates **three concerns**. Every component follows the same recipe so the library stays consistent and re-themeable, and never drifts back into "scattered" ad-hoc styling.

## The three layers

The source is organised to match, one directory per layer:

| Directory | What lives there |
|---|---|
| `src/simples/` | Single-purpose components — Button, Input, Dialog, Select. |
| `src/composites/` | Assemblies of simples that still fit inside a page — SidebarUser, StatCard, Breadcrumbs. |
| `src/layouts/` | Page-level scaffolding — AppShell, WorkspaceLayout, StatusBar, TopBar. |

The public barrel is flat regardless (`import { Button, AppShell } from "@kanzo-tech/ui"`), so
moving a component between layers is never a breaking change for consumers.

## The three concerns

1. **Behaviour (headless)** — [Ark UI](https://ark-ui.com) (`@ark-ui/react`). State, accessibility (WAI-ARIA), keyboard, focus. Compound parts, `X.RootProvider` + `useX` hooks for controlled state, and the `ark.*` polymorphic factory with **`asChild`**. Composites with their own state (Sidebar, WorkspaceLayout) use our own React Context providers/hooks. **No appearance here.**
2. **Appearance** — design tokens (`@kanzo-tech/theme/tokens.css`) + **`tailwind-variants`** recipes over token-backed Tailwind v4 utilities, compiled to `@kanzo-tech/ui/styles.css` (cascade layers). The look lives entirely here. **No appearance decisions inside component `.tsx` beyond picking recipe variants.**
3. **API** — a semantic vocabulary (`variant` / `size` / state / composition) that stays stable across upstream refactors. We use **`variant`**, matching Shark/shadcn and consumer expectation. (This document used to prescribe `intent`; no component ever exposed one.)

**Compositions** (product-specific screens, domain UI) live in the *products*, never in the library. The library is **domain-free**: nothing about RDF / SHACL / fossil / graphs / auth.

## Writing a component (the recipe)

```tsx
"use client"; // only if this file uses hooks / listeners — see "Client boundary" below

import { ark } from "@ark-ui/react/factory";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const fooVariants = tv({
  base: "…token-backed utilities…",               // bg-primary text-primary-foreground rounded-md …
  variants: { variant: { … }, size: { … } },      // semantic variants
  defaultVariants: { variant: "default", size: "md" },
});

export interface FooProps
  extends React.ComponentProps<typeof ark.button>,   // includes `ref` under React 19
    VariantProps<typeof fooVariants> { /* our extras */ }

export const Foo = (props: FooProps) => {
  const { variant = "default", size = "md", className, ...rest } = props;
  return (
    <ark.button
      className={cn(fooVariants({ variant, size }), className)}
      data-slot="foo"
      {...rest}
    />
  );
};
```

Reference implementation: `packages/ui/src/simples/button.tsx` (lowercase).

**React 19, not 18.** Our React peer is `>=19`, where `ref` is an ordinary prop. Use
`React.ComponentProps<…>` (which includes `ref`) and a plain function component. Do **not** use
`forwardRef` — it still works, but it is redundant — and never `ComponentPropsWithoutRef`, which
silently drops `ref`.

**`tailwind-variants` is imported directly**, not through a local shim. (There was a `lib/tv.ts`
re-export that 21 of 24 callers bypassed; it has been deleted. If we ever need a shared
`twMergeConfig`, that is the moment to reintroduce one seam — together with `lib/cn.ts` — and a
lint rule to enforce it.)

## Rules

- **Never** use inline `style={}` for variant appearance. Colours/sizes/radii come from **tokens** via utilities (`bg-primary`, `text-muted-foreground`, `rounded-md`, `h-9`). One-off structural inline style (e.g. a computed width) is fine.
- **Only token-backed utilities.** Use the semantic colour tokens (`background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring` + `info/success/warning` + `sidebar-*` + `chart-*`), the `--radius`-driven `rounded-*` scale, and the Kanzo extras (`--kanzo-font-size-*`, `--kanzo-syntax-*`). No raw hex, no raw palette (`bg-slate-700`) in components.
- **Focus rings** are Shark's utilities, not a token: `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32`, plus a `focus-visible:border-*` per variant.
  - Two sanctioned exceptions, both inherited from Shark: `text-white` for text sitting **on** a status fill (there is no on-fill status token — see the contract note at the top of `tokens.css`), and a raw colour on a swatch whose colour the user picked (`color-picker`).
- **`-foreground` means two different things.** For neutral/brand families it is the text that sits on the fill. For the status families (`destructive`/`info`/`success`/`warning`) it is a readable-on-**background** variant of the same hue — Shark's convention, adopted verbatim. Do not "fix" it; it would fork us from upstream. `tokens.css` documents both.
- **Theming = tokens only.** `KanzoThemeProvider` writes the axes as `data-*` attributes on `<html>`; that plus the host's `.dark` class and token overrides re-skin everything (e.g. `--radius: 0` = square borders by default) without touching components. The attributes must be on `<html>`, not a wrapper: Ark overlays portal to `document.body`, and density sets the root font-size the whole `rem` scale resolves against.
- **Adopt, don't rebuild.** Prefer bringing a [Shark UI](https://shark.vini.one) / Ark component (Splitter, TreeView, Steps, Command, Sidebar, Autocomplete…) and rebranding it to our tokens over hand-rolling. The only bespoke code is the CodeMirror editors (`EditorShell`/`GhostEditor`), which Ark/Shark don't cover.
- **Accessibility** comes from Ark — don't reinvent focus/keyboard/aria.
- **`data-slot` on every targetable part.** Every element a consumer might style or query carries `data-slot="<component>-<part>"`. It is not decoration: our own recipes depend on it (`in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3`), and it is the escape hatch consumers get instead of class-name guessing.
- **Exactly one `<main>` per page.** `AppShell` / `SidebarInset` own it. Every nestable container (`PageShell`, `WorkspaceLayout`, `TwoPaneLayout`) uses `<section>` — two `<main>` elements are an HTML conformance error and make "skip to main content" ambiguous.
- **File naming: kebab-case** (`alert-dialog.tsx`, `scroll-area.tsx`), matching Shark. Some older files are PascalCase; new files are kebab-case and the rest converge over time. Never rely on case-insensitive resolution — CI is case-sensitive even though macOS is not.

## Client boundary

The library is consumed by RSC hosts, so this is load-bearing, not hygiene.

- A file gets `"use client"` **iff** it calls a React hook, registers an event listener, or imports a module that does.
- Hook-free presentational components must **not** have it, so they stay server-renderable.
- The build must preserve the directives: `preserveModules` + `rollup-plugin-preserve-directives`. Rollup strips them when it merges modules, and that failure is invisible to any Vite-based harness, because Vite ignores `"use client"` entirely. `pnpm smoke` and the `docs/` App Router build are what catch it.
- Components that need an **optional peer** (`@codemirror/*`, `@tanstack/react-table`) never go in the root barrel: they live on their own subpath (`/editor`, `/table`). A static import of an optional peer from the root entry breaks `import { Button }` for everyone who did not install it.

## Testing

`pnpm test` runs vitest with a jsdom environment. The minimum bar for a component is a test
that renders it and asserts the behaviour its recipe depends on. Guard rails that must not
regress — the public export surface, the client boundary, optional-peer isolation — belong in
`packages/ui/src/index.test.ts` and `pnpm smoke`.

## Distribution

- `@kanzo-tech/theme` — tokens (`tokens.css`, `themes.css`), the axis table (`AXES`, `DEFAULT_PREFS`) and the value types. **No React, no components.**
- The theming runtime lives in `@kanzo-tech/ui`: `KanzoThemeProvider` (the single provider), `useKanzoTheme`, `themeScript` for SSR, `cookieStorageAdapter`, and the `Preferences` panel.
- `@kanzo-tech/ui` — components (JS, tree-shakeable) + `styles.css` (compiled, cascade-layered) + `/editor` subpath (CodeMirror, brand-agnostic). Consumers import `@kanzo-tech/ui/styles.css` once.
- Semver via changesets.
