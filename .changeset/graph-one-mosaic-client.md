---
"@kanzo-tech/graph": minor
"@kanzo-tech/mosaic": minor
---

**`GraphRoot` reads a corpus attached to the page's DuckDB, through the page's coordinator.** `corpus`
is gone. Attach the corpus with fossil's `open(name, { engine, url })` (`@fossil-lang/corpus`
≥ 0.3.0-alpha.24) and pass `from={name}` and `coordinator={coordinator}` — the same coordinator your
charts use. Where you wrote `<GraphRoot corpus={opened}>`, write
`<GraphRoot from={name} coordinator={coordinator}>`. `@fossil-lang/corpus` is no longer a peer of the
graph.

**A crossfilter greys out, it no longer hides.** A vertex a chart's brush does not keep stays where it
is, greyed, with its links; a running layout is no longer reset by a filter. A clause that names
columns no vertex type has fails as `graph/unfilterable` (was `graph/untranslatable-filter`); a type
that lacks the columns is simply not filtered by it.

**Position is a channel.** Bind `x` and `y` to two numeric columns — `lon` and `lat` draw a map — and
the points stand where the data puts them. Leave them unbound and the layout runs on its own on the
GPU from a seeded start. `cluster` binds the column the layout pulls points together by; `r` unbound
now sizes points by degree. `simulate` still overrides.

`status` no longer has `"opening"`. `GraphSearch` asks the corpus as the reader types, instead of
holding every title. `@kanzo-tech/mosaic` also exports `collectColumns`.

**`engine().query` runs on the coordinator's connection.** The second connection beside it is gone:
fossil's statements — the secret, the attach, the views — queue with the charts' and the graph's,
uncached. An abort rejects the caller's wait; the short statement finishes in the queue.
