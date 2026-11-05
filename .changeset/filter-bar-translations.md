---
"@kanzo-tech/ui": minor
---

`FilterBar` takes the words it draws through `translations`, as every other component does: `filters` (the bar's accessible name), `none` (*No filters*), `clear` (*Clear every filter*), `remove(label)` (a chip's ×), `counting` (*Counting…*), and the readout's `all(total, rowNoun)` and `kept(rows, total, rowNoun)`, which are handed counts already formatted for the locale. The English defaults are unchanged, and the type is `FilterBarTranslations`, exported from `@kanzo-tech/ui/analytics`.
