---
"@kanzo-tech/ui": minor
---

**What a part reads is one word, `relation`.** It is a table by name, a `Relation` — a type and hops
over the provider's `joins` — or SQL, as `table` was. Rename the prop:

| Part | Was | Now |
| --- | --- | --- |
| `ChartRoot`, `ChartTimeline`, `ChartStat` | `table` | `relation` |
| `ChartFilter`, `ChartSearch`, `ChartSlider` | `table` | `relation` |
| `FilterBar`, `Dashboard`, `ChartCard`, `DashboardStat`, `DetailTable` | `table` | `relation` |

- **`ChartRoot`'s `as` and `filterBy` are gone**: its marks filter by the page's selection and its
  interactors publish into it. To own a selection, put `filterBy` on the marks and `as` on the
  interactor, as vgplot does; `ChartHighlight` still takes `by`.
- **`ChartTimeline`'s `as`, `filterBy` and `paceBy` are gone**: play waits for every client of the
  page's selection. It counts the rows that have its column.
- **`Dashboard` takes the relation itself**: `relation={relation}` rather than
  `table={relationQuery(graph, relation)}`, under a provider given `joins`.
- **`useChartContext()`** has `table` (what the marks read), `relation` and `selection`; `filterBy` and
  `as` are gone.
- **`MosaicClients`** takes `relation` beside `enabled`, which now defaults to `true`.
- **`useMosaicInput`** takes `relation`, the relation its clause is published on.
