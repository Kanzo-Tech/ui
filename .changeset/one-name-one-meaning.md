---
"@kanzo-tech/ui": minor
"@kanzo-tech/theme": minor
"@kanzo-tech/graph": minor
---

A name means one thing in every package. **Breaking:** `@kanzo-tech/ui/table` no longer re-exports TanStack's `Table` type — `Table` from `@kanzo-tech/ui` is the markup component — so write `import type { Table } from "@tanstack/react-table"` where you name the instance `useDataTable` returns. `@kanzo-tech/theme`'s `Problem`, what `validateSection` and `validatePrefs` return, is `SectionProblem`. `@kanzo-tech/graph`'s `Selection` and `SelectionSource` are `VertexSelection` and `VertexSelectionSource` (the canvas's selection, `GraphState.selection` and `onSelect`'s argument), and `Pick`, what `usePick` returns, is `VertexPick`; a file that imported graph's `Pick` gets TypeScript's back, and one that aliased Mosaic's `Selection` to get past graph's can drop the alias.
