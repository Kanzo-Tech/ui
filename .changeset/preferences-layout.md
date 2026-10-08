---
"@kanzo-tech/ui": patch
---

`PreferencesSections` lays its preferences out in a two-column `FieldGroup`: a toggle takes one
column, with its name beside the switch, so two toggles share a row; everything else spans the
row, and a select's trigger is full width. A host that wrapped `PreferencesSections` in its own
flex column for spacing can drop the wrapper. `Slider`'s first and last markers now hang inward
from the ends of the track instead of centring on them, so a long label no longer runs past the
edge.
