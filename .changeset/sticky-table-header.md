---
"@kanzo-tech/ui": minor
---

**`Table` and `DataTableContent` can pin the header row: `stickyHeader`.**

A data table in a scrolling region loses its column names exactly when the rows need them, and the
usual one-line answer — `sticky top-0` on the `th` — does nothing here. `position: sticky` resolves
against the nearest scroll container, and there are two between the header and the region that
actually scrolls: `DataTableContent`'s bordered box (`overflow-hidden`, for the rounded corners) and
`Table`'s own wrapper (`overflow-auto`, for wide tables). Both are exactly as tall as their content,
so the header pins to a box that never moves.

`stickyHeader` stands both of them down. The box becomes `overflow-clip`, which still clips the
corners but is not a scroll container; the wrapper becomes `overflow-visible`. The header then pins
to whatever really scrolls — a `ShellMain`, a dialog body, the page.

Which scroll container it pins to is what the companion `maxHeight` decides.

Given a height, the wrapper stays a scroll container and simply gains one: the header pins to the
table's own scrollport and a wide table still scrolls sideways. Without a height the header pins to
whatever encloses the table, which reads better — one scrollbar instead of two — but gives up that
sideways scroll, because standing the wrapper's `overflow-auto` down is the same declaration that
provided it, and CSS cannot keep one axis scrollable while the other stays sticky. Columns past the
right edge then have nothing to scroll them, which at 430px meant two of them could not be read at
all. **Set `maxHeight` whenever the columns may not fit.**

The pinned cells are painted `bg-background`, so on another surface pass `className="bg-card"` to
`TableHead`.
