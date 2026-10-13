---
"@kanzo-tech/ui": patch
---

`ChartCard` ticks a count or a distinct count at whole numbers from zero — a count of 2 no longer reads *0.0, 0.5 … 2.0* — and a bar chart's label band widens to its labels, up to 28 characters, before it cuts one: *Univ. of California* is no longer *Univ. of Californ…* beside an empty card. The gesture under a chart's title is a sentence, *Click a bar to filter*. `nameWords(name, count)` is exported from `@kanzo-tech/ui/analytics`: a catalog's name in a reader's words, plural when `count` is not 1 — what `RelationPicker` already said its hops with.
