---
"@kanzo-tech/ui": minor
---

**`Dashboard` draws a relation that has columns named `x` or `y`.**

- A line or area over a time, the timeline filter and the tiles' trends failed on such a relation (a
  fossil corpus's layout coordinates, say) with "column … must appear in the GROUP BY clause". The
  plots now read the relation without the columns named like a plot channel (`x`, `y`, `x1`, `x2`,
  `y1`, `y2`, `fx`, `fy`, `z`, `fill`, `stroke`), and those columns are not offered as fields.
- `queryFieldStats` resolves to `{ fields, columns }` (was the field array) and `useFieldStats`
  returns `columns` beside `fields`. If you called `queryFieldStats`, read `.fields`.
