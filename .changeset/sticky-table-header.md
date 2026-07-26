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

It is a prop rather than the default because it costs something real: that wrapper's `overflow-auto`
is what lets a table wider than its box scroll sideways, and CSS gives no way to keep one axis
scrollable while the other stays sticky. With the header pinned, the enclosing region has to provide
the horizontal scroll. The pinned cells are painted `bg-background`, so on another surface pass
`className="bg-card"` to `TableHead`.
