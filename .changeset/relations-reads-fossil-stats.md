---
"@kanzo-tech/relations": patch
---

`readJoinGraph` now reads the column counts fossil writes. A graph's chunks state them under
`fossil:stats` as `{"version":1,"columns":{…}}`, and the reader took the document's top-level keys for
columns, so no column of a real fossil graph had `stats` — no distinct count, no commonest values, no
nulls or extent beyond the id's. A key column, whose values never repeat and for which fossil writes no
commonest values, now has its distinct count too. A `fossil:stats` of another version is read as
stating nothing.
