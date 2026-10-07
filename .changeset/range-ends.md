---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

A `range` preference may name its two ends: `ends: ["Links decide", "Tight groups"]`. `<Pref>` draws
them as the slider's markers. The slider's markers sit on whole numbers, so name the ends of a range
that runs from 0 to 1.

A listed `choice` may be `ordered: true` when its options are one scale, least to most. `<Pref>`
draws it as a stepped slider with the options as its markers, instead of a row of cards.
