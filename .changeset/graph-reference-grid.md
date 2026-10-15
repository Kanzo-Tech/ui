---
"@kanzo-tech/graph": minor
---

The dot grid behind a graph (`look.grid`, the "Dot grid" switch) is now drawn on a canvas under the
points instead of by a CSS gradient whose position was rewritten every frame. The dots are two CSS
pixels across at any `devicePixelRatio` (whole device pixels, in `--input`); they sit on the graph's
own space and subdivide 5, 2, 1, 0.5… as you zoom, so a pan or a zoom reads as moving over a plane.
This does not make the grid appear in a light theme where it did not: cosmos.gl's transparent
clear carries the light background's colour, and a software-composited browser adds it over the
grid — `/docs/design/graph` has the cause and the fix, which touches the greyout. It is drawn only in a frame where the camera moved. On
the 1280×720 bench it keeps every run's p50 and p95 frame interval where no grid leaves them, and
the CSS grid it replaces did not (4 of 9 runs dropped frames at 1×); it costs about 1 ms of renderer
CPU in a frame that moves the camera. `look.grid` and `look.vignette` are unchanged and the grid is
still on by default. The grid element is a `<canvas data-slot="graph-canvas-grid">` now, where it
was a `<div>`: if a stylesheet or a test reached it as a `div`, reach it by that slot.
