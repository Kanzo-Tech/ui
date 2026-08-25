# A filter is a predicate, not a mask

- **Status** live — 2026-08-17
- **Decided** A source is a `MosaicClient` of the page's coordinator, and the crossfilter's predicate
  rides in the query that draws. What comes back is what survives. The greyout stops expressing the
  page's filters and goes back to expressing the one thing it is: which points the reader picked.
- **Because** a view that can put the filters in its own query does not need a second question about
  who survived, and the answer to that question is the size of the corpus while the picture is not.
- **Reversed by** a source whose drawing read cannot carry an arbitrary predicate — a tile server
  answering fixed URLs, a level of detail that is a different relation rather than a `WHERE` — where
  the surviving ids really are the only thing the two halves can exchange.
- **Held by** `packages/graph/src/slice-client.ts`, `SliceRead`;
  `packages/graph/src/duck-source.test.ts`, "carries the page's predicate into the query that draws";
  `packages/graph/src/duck-source.test.ts`, "asks two questions where it used to ask three";
  `packages/graph/src/duck-source.test.ts`, "exempts the graph from the clause the graph publishes";
  `packages/graph/src/use-query-loop.test.tsx`, "is drawn, and the watch is released with the loop";
  `packages/graph/src/index.test.ts`, "keeps the Mosaic/DuckDB half off the root barrel".

## What the mask cost, measured

Against `docs/public/bench/1000000` in Chrome on 2026-08-17, one window of 20,000 marks over the
million-vertex corpus, through the page's own coordinator:

| the mask, per filter change | |
|---|---|
| `SELECT dense_id FROM corpus_Node` — every surviving id | 377 ms |
| widening a million ids into `(type, dense)` identities | 43 ms |
| looking each one up against the 20,000 resident | 30 ms |

Four hundred and fifty milliseconds of query and main thread, on every brush, to shade a picture
that never held more than twenty thousand marks. The predicate costs the opposite of that: the same
window measured **8.4 ms filtered against 12.0 ms unfiltered**, because fewer rows survive to be
numbered and sorted. The filtered query is *cheaper than the unfiltered one it replaces*, and the
377 ms is not replaced by anything.

## The greyout was two things, and only one of them was a hack

`highlightedPointIndices` greys every point not in the array. It was carrying two claims at once:

- *what survives the page's filters* — a fact about the corpus, which a `WHERE` states exactly, and
  which had to be fetched and re-applied because the drawing query could not be told about it;
- *what you just lassoed* — a fact the host is already holding, from a gesture in its own file.

The second is what the renderer's greyout is *for*, and it stays: `docs/showcases/workspace/graph-canvas.tsx`
sets it from `selection.vertices` with no query at all, re-resolved against each answer because a
buffer index names a slot in the current one. What went is the round trip.

## Publishing takes the exemption back

`IdSetClient` declines the self-exemption a crossfilter is built on, and its own comment says why:
*a view that FADES an excluded row does not need it — the row is still on screen and still
selectable, and the fade is the brush.* The moment the canvas draws what survives, that inversion
stops being clever and starts deleting the reader's context: a lasso of thirteen nodes would answer
by removing the other 1,530. So `DuckSource.publish` names its own reads in the clause's `clients`
set, the charts move, and the canvas shows the lasso in context. Verified in the browser on the
workspace showcase: an order selecting 231 contracts left 1,543 nodes drawn with 231 lit, while the
legend and the footer read 231 of 1,543; a clause published by anything else — `kind = 'member'` —
redrew the canvas as 35 points and 0 edges, and retracting it restored 1,543 and 4,280.

## The connector lever the plan was counting on does not exist

`.planning/ONE-PATH.md` and `BENCHMARKS.md` both costed this step at roughly forty milliseconds a
pan, on the reasoning that `detail()`'s three queries sum to 75 ms where the slowest is 35, and that
issuing them on separate connections would collapse the sum to the max. The arithmetic is right and
the premise is false. `probeConnectionOverlap` in `docs/showcases/graph-bench/measure-bounded.ts`
gives one connection a sort it cannot fold away and a second connection a trivial query in the same
tick; across four runs the trivial query answered at 511.8, 462.9, 454.8 and 449.5 ms against sorts
of 511.7, 462.8, 454.7 and 449.4. **Connections queue; they do not overlap.** DuckDB-WASM is one
worker behind one message port, and a second connector buys a second registration and no
concurrency.

So the query saving here came from asking less, and it is small and honest: the third query is
gone — `count(*) OVER ()` is evaluated before `LIMIT`, so the points read already knows how many
matched, and the separate `SELECT count(*) … WHERE <the same predicate>` was a second scan for a
number the first had computed. Measured on the same corpus and window, a pan's queries finished at
**29.0 ms with the third and 25.1 ms without it**, and the matched count agreed to the row: 28,424
both ways. The end-to-end window figures — 82 ms cold, 3 ms repeat, 41 ms overlapping pan, recorded
when the tile cache landed — did not move outside their own run-to-run spread, because at this size
they are dominated by the HTTP the tiles arrive over.

## What this does not touch

The reads that are about the corpus rather than about the page — `total()`, `extent()`, the tile
footers — take no `filterBy`. A `total()` that shrank with the filters would make the view's own
"20,000 of 1,000,000" a fraction of itself, which is the one number a bounded renderer owes its
reader honestly.

And it does not change the curve. The window is still linear in the corpus, the edge join still
scans a whole relation with nothing to prune, and this step was never on the path that fixes either
— `BENCHMARKS.md` item 1 is.

**One thing is left dangling and is named rather than tidied.** `IdSetClient` in
`@kanzo-tech/ui/analytics` was the shape this replaces, and the graph was its only consumer in this
repository. It still ships, still has its own test, and is still what a view whose positions are
outside the database reaches for when it *fades* rather than filters — a case this record's
*Reversed by* describes exactly. Whether that is a second call site or an export that has run out of
them is `an-export-needs-a-second-call-site`'s question, and it is open.
