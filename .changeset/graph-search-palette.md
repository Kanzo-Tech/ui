---
"@kanzo-tech/graph": minor
---

**`GraphSearch` is a ⌘K palette.** In the page it is now a button styled as a field that prints ⌘K;
clicking it or pressing ⌘K / Ctrl+K opens the search centred and full-height over the canvas. `type:`
and `<column>:<value>` words become chips on Space, Enter goes to the highlighted vertex and closes,
⌘Enter selects every match. Empty, it lists your recent picks and every vertex type with its count,
and picking a type makes it a chip; each match shows its IRI's local name on the right, so matches
with the same title can be told apart. `placeholder`, `size` and `limit` are unchanged; `className` and `size`
now style the button, and `size` is `"sm" | "md" | "lg"`. Mount one per page: the key opens every
palette that declares it.

**`GraphInspector` is compact.** It heads with the vertex's type over its title or IRI local name
(the whole IRI in the tooltip), offers **Locate** and **Select neighbours** as labelled buttons in
place of the zoom, focus and copy icons, moves the IRI's copy button beside the IRI, no longer lists
the neighbourhood, lays the fields out in two columns, and drops its card, so a dock no longer draws a
second border around it. Rows your render prop adds line up without classes of their own: drop any
you set on its `DataListItem`s.

**`reveal` frames the vertex with its neighbours** (Locate, and Enter in the search), and the camera
stays there: a resize or a settling layout no longer puts the whole graph back.

**Add `@kanzo-tech/graph/tailwind.css` to your stylesheet**, after `@kanzo-tech/ui`'s:

```css
@import "tailwindcss";
@import "@kanzo-tech/ui/tailwind.css";
@import "@kanzo-tech/graph/tailwind.css";
```

Without it, classes only the graph's parts use are never generated — the search palette, for one,
collapsed to a bare input.
