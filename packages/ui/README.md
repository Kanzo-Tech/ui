# @kanzo-tech/ui

Kanzo's shared UI surface — **Ark UI** behaviour, **tailwind-variants** appearance, design tokens
between them. The component set is adopted from [Shark UI](https://shark.vini.one) and re-branded to
the Kanzo tokens.

```tsx
import "@kanzo-tech/ui/styles.css";
import { Button, KanzoThemeProvider } from "@kanzo-tech/ui";
```

## What is in it

- **`simples/`** — one component, one job: the adopted primitive set (inputs, overlays, menus,
  navigation, data display) with a flat compound API — `DialogTrigger` and `DialogContent`, not
  `Dialog.Trigger`.
- **`composites/`** — assemblies of those that stay domain-free: the sidebar, the code editor, the
  `Preferences` theme panel.
- **`layouts/`** — the Shell and Section regions. Structure only, no appearance.

Everything is exported flat from the root, so a component moving between layers is never a breaking
change. The docs site lists the surface with a live example per component; `DESIGN.md` in the
repository says how the three layers divide and what has to be true before a component is added.

## Subpaths

The root barrel never statically imports an optional peer, because that would break
`import { Button }` for everyone who did not install it. Anything that needs one lives on its own
entry:

| Entry | Peer |
|---|---|
| `@kanzo-tech/ui` | none beyond React and `lucide-react` |
| `@kanzo-tech/ui/editor` | `@codemirror/*` |
| `@kanzo-tech/ui/table` | `@tanstack/react-table` |
| `@kanzo-tech/ui/analytics` | `@uwdata/vgplot`, `@uwdata/mosaic-*`, `@duckdb/duckdb-wasm` |

## Theming

`KanzoThemeProvider` writes the theme axes as `data-*` attributes on `<html>` — required, because
Ark's overlays portal to `document.body`. `useKanzoTheme()` drives them, `themeScript()` prevents an
SSR flash, and `<Preferences />` is the live editor. Tokens and axes come from `@kanzo-tech/theme`.

Admission rule: nothing domain-specific — no RDF, SHACL, fossil, graph or auth knowledge.
