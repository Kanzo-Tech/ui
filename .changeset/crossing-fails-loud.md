---
"@kanzo-tech/mosaic": minor
---

A clause that cannot be crossed into a relation the joins cannot walk (an edge that does not leave
the type reached) now throws a `JoinError` with `code: "join/no-step"`, where it used to read as
`FALSE` and draw an empty chart with no failure. A relation with no way across a clause still keeps
none of it, as before. If a page relied on a broken relation rendering empty, fix the relation.
