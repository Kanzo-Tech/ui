# Graph scale

Where cosmos.gl 3.4.0 stops, measured rather than quoted. Re-run with
`node docs/showcases/graph-bench/run-bench.mjs` against a dev server, or drive
`/view/showcases/graph-bench` by hand.

- **Renderer:** ANGLE / Metal on an Apple M4 Pro — WebGL 2.0, hardware, not SwiftShader
- **Measured:** 2026-07-30
- **Shape:** hyperbolic random graph, mean degree 14, seeded — power-law degree tail, angular
  communities, the structure the repulsion force is actually tuned against

`Per step` is the mean of 40 batched `graph.step()` calls flushed by a `getPointPositions()`
readback. The readback is the point: `step()` queues GPU work and returns, so without a barrier the
loop times nothing. Counting frames instead would count `requestAnimationFrame`, which is pinned to
the display and reports the same number for every graph below the ceiling.

| Nodes | Links | Generate | Upload | Per step | Step ceiling |
|---|---|---|---|---|---|
| 2,000 | 12,534 | 5 ms | 61 ms | 1.46 ms | 684 fps |
| 10,000 | 69,265 | 22 ms | 151 ms | 4.32 ms | 232 fps |
| 50,000 | 331,612 | 110 ms | 378 ms | 9.92 ms | 101 fps |
| 200,000 | 1,373,249 | 705 ms | 1,800 ms | 60.87 ms | 16 fps |
| 500,000 | 3,445,504 | 4,100 ms | 6,100 ms | 127.04 ms | 8 fps |
| 1,000,000 | 6,897,357 | 8,642 ms | 11,689 ms | 445.67 ms | 2 fps |

**Nothing failed.** A million points and near seven million links initialise, upload and simulate.
The question was never whether the renderer survives; it is what the layout costs once it does.

## What the numbers say

**A live simulation is comfortable to ~50,000 and finished by ~200,000.** The step ceiling crosses
60 fps somewhere just under 100k and 30 fps around 150k. At 200k a step costs 61 ms, so the layout
alone is drawing at 16 fps before anything else on the page has run.

**Past that, the layout stops being live and becomes a column.** At 500k and above the honest design
is precomputed positions — laid out once, stored, and rendered. Drawing a million points is cheap;
*solving* a million points sixty times a second is not, and no renderer changes that. This is the
one architectural consequence worth carrying: our positions can live in DuckDB alongside everything
else the graph already queries.

**Upload dominates below 50k.** At 2,000 points the upload is 61 ms against a 1.46 ms step — forty
steps' worth of work to show the first frame. Anything that rebuilds the graph on a filter change is
paying that, repeatedly, for a graph the GPU could re-solve in a frame and a half.

**Generation is superlinear and it is ours, not cosmos.gl's.** 500k took 4.1 s and 1M took 8.6 s to
build in JavaScript, on the main thread, before the renderer saw a single float. For synthetic
fixtures that is merely slow; for a real corpus it is the same shape of cost `load()` pays turning
DuckDB rows into typed arrays, and it belongs in a worker.

## The frames column is missing, deliberately

`requestAnimationFrame` does not fire in a background tab — not late, not throttled, never — and
cosmos.gl drives its simulation from rendered frames. A hidden tab therefore does not measure a slow
graph; it measures a stopped one. These numbers were taken while the window was not frontmost, so
the harness reported `fps: null` and the table leaves it out rather than printing a plausible
invention. Everything above is measurable regardless of visibility: batched `step()` calls and a
readback touch no rAF.

To fill that column, run the sweep with the browser window genuinely in front. `run-bench.mjs`
refuses to write a file otherwise, and refuses SwiftShader for the same reason.

## Method notes

Two mistakes were made and corrected while building this, both of which produce confident wrong
numbers rather than errors:

- **The preview graph shared the GPU with the graph under test.** The first run reported 45 fps for
  2,000 points against a 685 fps step ceiling, because it was measuring two graphs. The preview is
  now torn down for the duration of a sweep — destroyed, not paused, since a paused simulation still
  redraws its links every frame.
- **Generation sat outside the `try`.** At a million points it allocates tens of megabytes, which is
  exactly where a run dies, and a throw there escaped the harness entirely — leaving a sweep that had
  covered five of six sizes and looked finished. A ceiling that reports itself as success is worse
  than no benchmark.

Both are the same failure: a benchmark is only as good as its willingness to say *I could not
measure that*.
