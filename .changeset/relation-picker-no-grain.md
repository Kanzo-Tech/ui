---
"@kanzo-tech/ui": minor
"@kanzo-tech/testing": minor
---

`RelationPicker` no longer writes a grain line (*One row per Comment · 151,043 rows · …*) under its chips: each hop's fan-out in *Add related…* already says what it does to the rows. `RelationPickerHarness.grain()` is removed; read the path with `path()`.
