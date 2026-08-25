# The coordinate box is the corpus's extent, and this side declares no default for it

- **Status** live — 2026-08-19
- **Decided** `@kanzo-tech/graph` exports no `SPACE`. `useRenderer` passes no `spaceSize` to
  cosmos.gl at construction, and `useQueryLoop`'s framing — the one place that already awaits an
  `extent()` — sets it from that extent's larger side before the first slice is asked for.
  `clusterRing` is handed the box it is placing a ring in rather than reading a constant.
- **Because** the coordinate box is owned by whatever wrote the positions, and this side was
  declaring it.
- **Reversed by** a source that genuinely cannot answer `extent()`, which would need a `spaceSize`
  on the hook. Or by cosmos.gl making `spaceSize` init-only: today it is explicitly not one of the
  three fields `preserveInitOnlyFields` restores, and `updateStateFromConfig` re-runs
  `adjustSpaceSize` and `syncScreenSize` when it changes. Or by a render path where the box stops
  being a translation — a simulation force reads it as its gravity centre and its quadtree depth, so
  a live layout over an extent-derived box is where this would first be felt, and no measurement of
  that exists yet.
- **Held by** `packages/graph/src/coordinate-box.test.ts`, whose `sourcesUnder` scan fails on a
  numeric `spaceSize` or a `SPACE` declaration anywhere in the package; then
  `packages/graph/src/use-query-loop.test.tsx`, whose framing test pins `boxes` to the extent it
  was given; and the tombstone in `packages/graph/src/index.test.ts`.

`SPACE = 4096` was passed to cosmos.gl as `spaceSize` and **hand-copied into both bench
generators**, which is why the bench never disagreed with it: the generators produced inside 4,096
because they had been told to. A corpus fossil writes does not. Measured in the browser on
2026-08-17 over `docs/public/bench/1000000`, `source.extent()` answers x ∈ [−345, 645396],
y ∈ [−188, 516293] — **157× the box the renderer was announcing.**

It is the same shape as `CHUNK_SIZE` and the fixed column block before it, and the same failure
mode: nothing reports it. What the measurement adds is *how* nothing reports it. `spaceSize` enters
every cosmos.gl 3.4.0 render path as a **pure translation** — `Store.updateScreenSize` sets
`scalePointX.domain([0, S]).range([(w − S)/2, (w + S)/2])`, slope 1 for every S, and the vertex
shader's `2·point/S − 1` is immediately multiplied by `S/screenSize`, leaving
`(2·point − S)/screenSize` — so it shifts the origin and scales nothing. There is no clipping to the
box, `screenToSpacePosition` stays exactly linear far outside it, and the camera is fitted from the
extent by `frame()` anyway. **Nothing visible was broken by the wrong box** — all one million points upload, all one million come back from a rect selection over the whole canvas, and hit-testing lands within a point radius of the cursor out at 645396. The reason to fix it is therefore not a
defect: the box was a false statement about someone else's data, and a constant exported for a host
that could not answer `extent()` was a second path for nobody — all three sources answer it
(`memorySource` from a pass over the positions it holds, `duckBoundedSource` from four aggregates,
`openCorpus` from the tile footers).

**Two cases do not fit, both measured in a foreground tab on 2026-08-19 at 800×600.**

The first is a real defect this decision does **not** fix. cosmos.gl's d3-zoom carries
`scaleExtent([1e-3, ∞])`, and framing an extent needs `screen / span`. The million fits at
0.00116, which is 1.16× off that floor. **The five-million corpus does not**: its extent is
x ∈ [−263.43, 5289375], y ∈ [−3130.62, 3252766.5], the fit wants 0.000151, and `getZoomLevel()`
after `fitViewByPointPositions` reports exactly 0.001 — clamped, with about 15% of the width on
screen and no way to ask for the rest. The zoom floor is independent of the box, so nothing here
moves it; it is a separate decision about whether a corpus is rescaled on the way in or the
renderer is asked to lift the floor.

The second is a consequence of this change rather than a survival from before it. `adjustSpaceSize`
reduces the box to half the device's `maxTextureDimension2D` — 16384 here, so 8192 — whenever it
meets that limit, and says so: `The `spaceSize` has been reduced to 8192 due to WebGL limits`. A
million-vertex corpus trips it on every open, and the config keeps the asked-for value while the
store uses the reduced one. It costs nothing but the line: the reduction is a translation like every
other space size, the uploaded positions are byte-identical either way, and the fit runs after the
set. It is left visible rather than clamped on our side, because a corpus larger than the renderer
can name as a box is worth one line in a console.

**What this does not decide** is what a host does when it has no extent. Nothing has that shape
today, so there is no default of ours; until the first extent lands, cosmos.gl's own default stands,
and it is the library's number to defend. **What none of the guards can prove** is that the box that
*is* set is right — a wrong translation is invisible to a screenshot as much as to a test.
