---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/testing": minor
---

**`RelationPicker` reads each hop as a sentence and says what it costs.** The **+ Hop** menu is now
**+ Add related…**, in two groups: *Follow from each Place* (*The place it is part of*) and *Bring
in what points at it* (*Comments located in this place*), each sorted by fan-out and showing it —
*1 per Place*, *~103 per Place*, in warning colour above ten. The path is chips, and any of them can
be removed (*Remove Comments located in this place*), cutting the path there. Under them a grain
line, a `status`, says what a row now is: *One row per Comment · 151,043 rows · Places without
comments are left out*. The joins are still inner; the line says so. New props: `phrase(edge,
direction)` to reword a hop the templates read wrong (a self-edge's *parent*/*children*), and
`plural(type)` (*People*).

`JoinType` and `JoinEdge` take an optional `rows`, and `joinGraphOf` / `readJoinGraph` fill it from
the catalog's record counts. `relationHops` now takes the whole `JoinGraph` (it reads the types'
`rows`) and each `RelationHop` carries `fanOut` when both counts are there.

`@kanzo-tech/testing` adds `RelationPickerHarness`: `root()`, `pick(type)`, `add(hop)`, `path()`,
`remove(sentence)` and `grain()`. `add` takes a hop's sentence, its step as `relationKey` writes it
(`<replyOf<Comment`, `>isPartOf>Place`), or its bare edge label where only one item has it. A suite
that clicked the menu item by its old name moves to it: `getByRole("menuitem", { name:
"replyOfPost → Post" })` becomes `picker.add(">replyOfPost>Post")` (or `"replyOfPost"`), and
`"← isLocatedIn · Comment"` becomes `"<isLocatedIn<Comment"`. The `dom` environment's `click` now
releases a task after it presses, as a real pointer does, so a menu item selects in jsdom.

The analytics subpath grows 33.82 → 34.70 kB (limit raised to 34.8 kB); the root barrel and a single `Dashboard` do not move.
