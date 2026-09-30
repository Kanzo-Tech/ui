---
"@kanzo-tech/graph": minor
---

**The graph draws the whole corpus, and reads fossil's `fossil/1` format.** `GraphRoot` now takes a
corpus opened by a `@fossil-lang/corpus` that speaks `fossil/1` — a `fossil.json` manifest, one
table per vertex type and per relation, and one `dense_id` across the corpus. Every vertex type with a
position is drawn at once, with every relation between them, read once when the corpus opens; panning
and zooming read nothing.

- `type` and `limit` are gone from `GraphRoot` and `useGraph`. Colour is the vertex type unless you
  bind `fill`, and a label is each type's `identity` unless you bind `title`.
- `VertexId` is now a `number`, the corpus's `dense_id`. `vertexId`, `typeOf` and `denseOf` are gone:
  pass the id itself where you called `vertexId(type, id)`.
- The api has no `frameBox` and no `getResident`, and the `Resident` type is gone. Use `fit`,
  `zoomBy`, `reveal` or `frameSelection` to move the camera.
- The state has no `z`, `pending` or `declined`; `drawn.marks` and `drawn.represented` are now
  `drawn.vertices`; and `status` says `loading` where it said `reading`.
- `adaptive` is gone. Start a large corpus's users at other force values through your tenant policy.
- A crossfilter clause now hides the vertices that do not survive rather than re-reading what is on
  screen; a clause on a column no drawn type has reaches `onFailure`.

`simulate`, `sim`, `simFrom` and the toolbar's layout controls are unchanged.
