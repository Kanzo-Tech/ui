---
"@kanzo-tech/graph": minor
---

**A greyed-out point is as visible as the theme allows while staying 3 : 1 from the kept one**
(`/docs/design/crossfilter#the-greyout`). The canvas derives `pointGreyoutOpacity` from the colours it
paints and the background it paints on, both resolved from the live theme's tokens: the largest
opacity, in thousandths, that keeps every kept colour at 3 : 1 (WCAG 2.2 SC 1.4.11) from itself
greyed — cosmos.gl's greyed colour, composited over the background, measured in the 8-bit sRGB the
screen shows. It was a fixed 0.1, which on the Kanzo themes left greyed marks barely distinguishable
from the page.

- On the shipped themes it is 0.557 (Kanzo), 0.704 (Kanzo dark), 0.725 / 0.901 (Lo-fi), 0.812
  (Catppuccin Mocha), 0.250 (Nord dark), and 0.049 / 0.058 for Catppuccin Latte and Nord, whose
  category colours sit at 3.05 : 1 to their background and leave the greyed mark almost no room.
- A host's own theme gets its own value, recomputed at every repaint (a theme or look change).
- Links greyed out are at cosmos.gl's default, `linkGreyoutOpacity` 0.1, in place of 0.025.

The graph's size budget is raised as a decision, from 24.3 kB to 24.5 kB: 24.25 kB measured before
and 24.48 kB after — the luminance, compositing and search of `render/greyout.ts`.
`@kanzo-tech/theme` is a dev dependency of the package: its WCAG `contrast` and its themes' tokens are
the test's oracle.
