---
"@kanzo-tech/graph": patch
---

The dot grid now shows in a light theme. cosmos.gl cleared its canvas to the page's colour at alpha 0,
which the browser added over everything beneath the canvas instead of treating it as transparent, so a
light page behind a graph read white and hid the grid (and a translucent link carried the background
twice); the canvas now clears to a transparent pixel. A greyed point and a greyed link keep the
colours the greyout derives, in light and dark, and the dark theme's picture is unchanged.
