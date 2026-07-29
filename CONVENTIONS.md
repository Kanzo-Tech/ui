# Kanzo UI — conventions

How to write code in this system. **`DESIGN.md` is the companion: what the system *is*** — the
three axes, the layers, the admission rules, and why the layout layer looks the way it does.

The design system separates **three concerns**. Every component follows the same recipe so the library stays consistent and re-themeable, and never drifts back into "scattered" ad-hoc styling.

## The three layers

The source is organised to match, one directory per layer:

| Directory | What lives there |
|---|---|
| `src/simples/` | Single-purpose components — Button, Input, Dialog, Select. |
| `src/composites/` | Assemblies of simples that still fit inside a page — SidebarUser, StatCard, Breadcrumbs. |
| `src/layouts/` | Window scaffolding — the Shell regions. **Structure only, no appearance** (see `DESIGN.md`). |

The public barrel is flat regardless (`import { Button, ShellRoot } from "@kanzo-tech/ui"`), so
moving a component between layers is never a breaking change for consumers.

## The three concerns

1. **Behaviour (headless)** — [Ark UI](https://ark-ui.com) (`@ark-ui/react`). State, accessibility (WAI-ARIA), keyboard, focus. Compound parts, `X.RootProvider` + `useX` hooks for controlled state, and the `ark.*` polymorphic factory with **`asChild`**. Composites with their own state (Sidebar) use our own React Context providers/hooks. **No appearance here.**
2. **Appearance** — design tokens (`@kanzo-tech/theme/tokens.css`) + **`tailwind-variants`** recipes over token-backed Tailwind v4 utilities, compiled to `@kanzo-tech/ui/styles.css` (cascade layers). The look lives entirely here. **Nothing themeable is decided inside a component `.tsx` beyond picking recipe variants** — see "Themeable vs structural" below for where that line falls.
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

- **Themeable vs structural.** The invariant is **re-themeability**, not class-name purity.
  - **Themeable** — anything a token or a theme axis could change: colour (`bg-card`, `text-muted-foreground`, `border-border`), radius, typography, spacing scale, borders, shadows, animation. This **must** live in a `tv()` recipe, including when it is conditional. A ternary assembling `border-r border-border` in the function body is the same violation as an inline `style` — it just wears a different hat.
  - **Structural** — pure box model that no theme touches: `flex`, `flex-col`, `min-w-0`, `shrink-0`, `absolute inset-0`, `overflow-hidden`. This may sit inline on the element. Wrapping it in a variant-less `tv()` is ceremony, not architecture — a `tv()` with a base and no variants is a string with extra steps.
  - The test: *if a consumer re-skinned the library through tokens, would they expect this to change?* Yes → recipe. No → inline is fine.
- **Never** use inline `style={}` for variant appearance. Colours/sizes/radii come from **tokens** via utilities (`bg-primary`, `text-muted-foreground`, `rounded-md`, `h-9`). One-off **computed** structural style (a width derived from a prop or from drag state) is fine; a hard-coded constant is not — `minWidth: 200` belongs in `min-w-[200px]`, where a class can still override it.
- **Only token-backed utilities.** Use the semantic colour tokens (`background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/field/ring` + `info/success/warning` + `sidebar-*` + `chart-*`), the `--radius`-driven `rounded-*` scale, and the Kanzo extras (`--kanzo-font-size-*`, `--kanzo-syntax-*`). No raw hex, no raw palette (`bg-slate-700`) in components.
- **`border-input` outlines, `bg-field` fills.** They were one token, and WCAG 1.4.11 applies to only one of them: the outline is the visual boundary that identifies a control, a switch track or a progress trough is not. `border-input` is the outline; `bg-field` is the fill, and it is an **alpha step**, so it never carries a `/NN`. An opacity dilutes a solid toward transparent and lands wherever the thing underneath puts it; an alpha step is solved to composite onto its own solid.
- **Focus rings** are `outline-none focus-visible:ring-[3px] focus-visible:ring-ring`, plus a `focus-visible:border-*` per variant. Shark writes `ring-ring/50` here; ours is **solid**, because the diluted form measured 1.29:1 on the page and 1.4.11 names a focus indicator first. A soft `--ring-soft` alpha token was tried for these 37 sites and dropped — an alpha step composites back to its own solid over step 1, so on a page it was the same colour as `ring-ring` while costing the accent hue `--ring` still carries.
  - One sanctioned exception: **a colour that is data** — a chart series, a palette slot, a colour the user picked. Use `Swatch` / `SwatchGroup` where it is being depicted, and `ColorPicker` where it is being chosen; a raw `style` is correct in both, because no token can name a value that is not known until runtime.
  - There used to be a second, `text-white` for text on a status fill, "because there is no on-fill status token". There is now: `text-destructive-content` and its three siblings. The exception is worth remembering as a lesson rather than a rule — while it stood, that white was measured at 2.13:1 on the warning fill and 3.81 on destructive, and nothing caught it, because an untokenised colour is a colour no test can measure. An exception to this rule is where a defect goes to hide.
- **`-foreground` means two different things.** For neutral/brand families it is the text that sits on the fill. For the status families (`destructive`/`info`/`success`/`warning`) it is a readable-on-**background** variant of the same hue — Shark's convention, adopted verbatim. Do not "fix" it; it would fork us from upstream. `tokens.css` documents both.
- **Theming = tokens only.** `KanzoThemeProvider` writes the axes as `data-*` attributes on `<html>`; that plus the host's `.dark` class and token overrides re-skin everything (e.g. `--radius: 0` = square borders by default) without touching components. The attributes must be on `<html>`, not a wrapper: Ark overlays portal to `document.body`, and density sets the root font-size the whole `rem` scale resolves against.
- **Adopt, don't rebuild.** Prefer bringing a [Shark UI](https://shark.vini.one) / Ark component (Splitter, TreeView, Steps, Command, Sidebar, Autocomplete…) and rebranding it to our tokens over hand-rolling. The only bespoke code is the CodeMirror editors (`CodeEditor`/`GhostEditor`), which Ark/Shark do not cover.
- **Accessibility.** Two clauses, because "accessibility comes from Ark" is not true of this codebase — Ark ships no sidebar, status bar, toolbar, field array or app shell.
  - **Where Ark ships an equivalent, use it.** Never hand-roll focus, keyboard or ARIA it already provides; check `@ark-ui/react/dist/components/` before writing a state machine.
  - **Where Ark has none**, the bespoke part must **document its ARIA contract in a comment** and be **covered by a test** — and must never declare a composite role (`toolbar`, `listbox`, `tree`, `grid`, `tablist`) without implementing that role's keyboard contract. A `role="toolbar"` whose items are each independently tabbable, with no arrow-key roving, is worse than no role at all: it promises assistive tech a navigation model that isn't there.
- **`ark.*` on every part that renders a DOM element** — simples, composites *and* layouts, with no exemption. `<ark.div>` renders a `div` and forwards everything, so it costs nothing at runtime; what it adds is **`asChild`**, universally. This rule used to be implied by the recipe and observed only in `simples/`, which let `Toolbar` ship a doc comment promising `asChild` support it did not have. Type props as `React.ComponentProps<typeof ark.div>`, never as `ComponentProps<"div">`.
- **`data-slot` on every targetable part.** Every element a consumer might style or query carries `data-slot="<component>-<part>"`. It is not decoration: our own recipes depend on it (`in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3`), and it is the escape hatch consumers get instead of class-name guessing.
- **Exactly one `<main>` per page.** `ShellMain` / `SidebarInset` own it. Every nestable container (`PageShell`) uses `<section>` — two `<main>` elements are an HTML conformance error and make "skip to main content" ambiguous.
- **File naming: kebab-case** (`alert-dialog.tsx`, `scroll-area.tsx`), matching Shark. Some older files are PascalCase; new files are kebab-case and the rest converge over time. Never rely on case-insensitive resolution — CI is case-sensitive even though macOS is not.
- **Export naming: flat, never dot-notation.** Ark publishes namespaced parts (`Accordion.Root`,
  `Dialog.Trigger`); we flatten them the way Shark does, so the barrel stays flat and a part is
  greppable by its full name. The root part is named by what it wraps:
  - **Wrapping an Ark machine → the bare name.** `Accordion`, `Field`, `Pagination`, `Table`,
    `InputGroup` — the machine *is* the component, so `AccordionRoot` would only add noise. Parts
    are base + part: `AccordionItem`, `FieldLabel`, `PaginationItem`.
  - **Our own compound → `*Root`.** `ShellRoot`, `SectionRoot`, `CompleteRoot`, `SuggestRoot`,
    `ChartRoot`, `DataTableRoot` — the bare name would name a *concept* rather than an element,
    and several of them have no single machine behind them.
  A component may only export dot-notation if it also exports the flat names; no component does
  today, and adding one would make the library speak two dialects.

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

- `@kanzo-tech/palette` — the colour derivation: ramps, the categorical search, the role table, `compile`. **Authoring-time only** — a tenant document is derived once at onboarding (the categorical search alone costs 0.2–7.4 s) and the runtime does nothing but apply it. It is a separate package so that promise is structural: out of the browser's dependency graph the search *cannot* be imported, rather than merely should not.
- `@kanzo-tech/theme` — tokens (`tokens.css`, `themes.css`), the axis table (`AXES`, `DEFAULT_PREFS`) and the value types. **No React, no components, no colour maths.** Depends on `@kanzo-tech/palette` as a **devDependency** — the generator and the tests derive with it, a browser never does, and `packages/theme/src/boundary.test.ts` fails if that moves.
- The theming runtime lives in `@kanzo-tech/ui`: `KanzoThemeProvider` (the single provider), `useKanzoTheme`, `themeScript` for SSR, `cookieStorageAdapter`, and the `Preferences` panel.
- `@kanzo-tech/ui` — components (JS, tree-shakeable) + `styles.css` (compiled, cascade-layered) + `/editor` subpath (CodeMirror, brand-agnostic). Consumers import `@kanzo-tech/ui/styles.css` once.
- Semver via changesets.
