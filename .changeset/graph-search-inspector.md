---
"@kanzo-tech/graph": minor
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": patch
---

**`GraphSearch` is a palette, and `GraphInspector` a card with the vertex's neighbourhood.**

`GraphSearch` is built on `Command` now. Matches are grouped by vertex type, counted past `limit`,
drawn with the canvas's glyph and the typed text highlighted. Two prefixes narrow a search:
`type:Person` keeps one vertex table, and `team:2` keeps the vertices whose `team` contains `2`.
What the reader picks is remembered for the root's life and listed as Recent while the input is
empty. **Select N matches** selects every match as an `"external"` selection, and ⌘K / Ctrl+K moves
to the search of the graph the reader last used. `className` now goes on the palette's box, not on
the input; `size` is `CommandInput`'s.

`GraphInspector` draws a card. Its header holds the title, a copy-IRI button, the type badge, and
**Zoom**, **Focus** and **Copy**. Focus selects the vertex and its neighbours as an `"external"`
selection named "Neighbours of …". The fields are grouped as Identity, Values and Dates, an IRI is a
link, and long text is clamped. A **Neighbours** section counts edges per relation and direction,
and pressing a row selects that set. `children` still receives the `VertexDetail`, and what it draws
comes after the values. If you wrapped the inspector in a bordered box of your own, drop the border:
the card has one.

`@kanzo-tech/mosaic` re-exports the mosaic-sql expression builders the graph uses: `asTableRef`,
`cast`, `count`, `eq`, `float64`, `isIn`, `length`, `literal`, `sql` and the `ExprNode` type.

`CommandInput` now hands its input props (`placeholder`, `aria-*`, `autoFocus`) to the input. Before
this, they landed on the group around it, so a `placeholder` passed to it was never shown.
`autoFocus` is still on by default, and you can pass `autoFocus={false}` for a palette inline in a
panel.
