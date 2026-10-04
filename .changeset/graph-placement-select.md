---
"@kanzo-tech/graph": patch
---

`GraphPlacement`'s column selects sit under the checked card instead of inside it. The card is the
radio's `<label>`, so selects inside it shared the radio's hit area: a click beside or on a select's
label went to the radio, which made Map's `x` and `y` hard to pick. The selects are now a group named
"Map columns" (or "Clustered columns"), each with a real `<label>`, reached by Tab after the radios.
No API change.
