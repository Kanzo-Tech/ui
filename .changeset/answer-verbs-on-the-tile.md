---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": minor
"@kanzo-tech/testing": minor
---

**An Ask answer's two verbs are on its tile, and Filter is there only when it filters.**
`AnswerCard`'s actions are icon buttons with a tooltip in the tile's own header, beside its title,
instead of two text buttons above the card:

- **Filter the page to these rows** (was *Filter to it*) keeps one name and is `aria-pressed` while
  its clause holds. It is **disabled** when the clause would keep everything in view — no conditions,
  a relation that is a type alone, and bars over every category of their column — and its tooltip and
  description say *This answer keeps everything in view*. Its chip in the `FilterBar` names what it
  filters: *Ask: Person.gender female*, *Ask: browserUsed · 3 selected*, rather than *Ask*.
- **Add to the dashboard** becomes **Open on the dashboard** once the tile is there, given the new
  `onOpen(added)`; without it, *On the dashboard*, disabled. `AnswerAdded` gains `id`, the tile's id
  in the relation's spec, so a host can bring it into view. A failed add is drawn under the tile.

To update a host: move the dashboard-view switch from `onAdd` to `onOpen`, which gets the same
`{ relation, key, id }`. Translations: `filtered` is gone (the button's name no longer changes);
`filter` is *Filter the page to these rows*; `added` is *On the dashboard*, without the check mark;
`keeps` and `open` are new. A test that found *Filter to it*, *✓ Filtered to it* or *✓ On the
dashboard* by name finds *Filter the page to these rows* (and reads `aria-pressed`), or *Open on the
dashboard* / *On the dashboard*.

`ChartCard` and `DashboardStat` take `actions`, the host's own controls in the header, before the
pencil.

`AnswerHarness.openOnDashboard()` presses *Open on the dashboard*; `addToDashboard()` waits for it
(or *On the dashboard*), and `filterTo()` rejects when the button is disabled.

The budgets are raised as a decision: `@kanzo-tech/ai`'s `./data` from 8.75 kB to 9 kB (8.58 -> 8.94 kB
measured), and `@kanzo-tech/ui`'s *one dashboard* from 33.9 kB to 34 kB (33.86 -> 33.92 kB).
