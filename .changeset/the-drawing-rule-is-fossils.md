---
"@kanzo-tech/graph": minor
---

**The guard against crossing `dense_id` spaces is fossil's now, and this package asks instead of
deciding.**

`openCorpus` used to work out for itself which relations a canvas may draw: a filter over
`addressing.incident(type)` keeping only the ones whose `srcType` and `dstType` are both the drawn
type, then a null check on the source-ordered adjacency, then a reason for each one it rejected.
That rule was correct and it was the second copy of it. The first lives in
`fossil_graph::plan::ReadPlan::drawing`, in Rust, beside the window that answers incidence, and it is
published on `@fossil-lang/corpus@0.3.0-alpha.6` as `addressing.drawing(type)`.

Two implementations of one rule agree until they do not, and the way this one stops agreeing is a
line drawn between two vertices that have no relation at all — `dst_dense` in one type's numbering
compared against `dense_id` in another's, both `BIGINT`, matching in silence. So the derivation is
deleted and the call takes its place. `tilesFor` is untouched and still correct: it answers
*incidence*, which is a different question, and confusing the two is the defect being closed.

**The peer range moves to `^0.3.0-alpha.6`**, which is the release that carries `drawing`.

**`UndrawnRelation.reason` is fossil's `GapReason`** rather than a local `"other-space" |
"not-declared"`. The two the drawing read produces are those two; the union also names
`"not-requested"`, which belongs to `tilesFor` and never reaches here, so an exhaustive `switch` over
this field gains an unreachable arm. `UndrawnRelation` itself survives because a `Gap` names a
relation by label and orientation, and a label does not identify one — the endpoint pair is what this
adds.
