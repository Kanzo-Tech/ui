---
"@kanzo-tech/graph": minor
---

**`GraphSearch` is a ⌘K palette.** In the page it is now a button styled as a field that prints ⌘K;
clicking it or pressing ⌘K / Ctrl+K opens the search centred and full-height over the canvas. `type:`
and `<column>:<value>` words become chips on Space, Enter goes to the highlighted vertex and closes,
⌘Enter selects every match. `placeholder`, `size` and `limit` are unchanged; `className` and `size`
now style the button, and `size` is `"sm" | "md" | "lg"`. Mount one per page: the key opens every
palette that declares it.

**`GraphInspector` is compact.** It heads with the title or the IRI's local name (the whole IRI in the
tooltip and behind Copy), lists the neighbours before the fields, lays the fields out in two columns,
and drops its card, so a dock no longer draws a second border around it.
