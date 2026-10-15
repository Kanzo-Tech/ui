---
"@kanzo-tech/ui": patch
---

`useFieldStats` no longer reads a relation with a `SUMMARIZE` because one of its columns is a list, a struct or another type no chart can draw: a column that can be no field counts for nothing, and a relation whose fields are all counted is read from the join graph alone.
