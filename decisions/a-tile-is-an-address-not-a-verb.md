# A tile is an address, not a verb

- **Status** live — 2026-08-15
- **Decided** The camera resolves to tiles by arithmetic over a manifest and a footer, both fetched
  once and kept. No request, no query and no service sits on that path. The question-answering
  surface is a separate one, it returns **ids**, and the canvas applies them as a mask over the tiles
  it already holds.
- **Because** a verb on the drawing path is a round trip on the path whose entire design exists to
  have none — the reader computes every URL it wants before it emits the first request.
- **Reversed by** an aggregation level whose tile set cannot be derived from what a reader already
  holds. Levels are separate relations with their own numbering, and if choosing among them ever
  needs an answer from the corpus rather than a number from the manifest, the camera has become a
  question and this record is wrong.
- **Held by** `packages/graph/src/bounded.ts`, `SliceQuery`; `packages/graph/src/duck-source.ts`,
  `duckBoundedSource`.

## It was a verb, on the other side of the seam, and it was deleted

This is not a position we reasoned to independently. fossil's read surface is a closed set of six
verbs, and its own page has a section headed *What is not a verb* whose first entry is the camera:

> Level-of-detail is not a filter — it reads a *different relation*, and a `WHERE` cannot change
> which table it reads. So the camera computes a level and a set of tiles and asks for bytes, with no
> SQL and no database on that path.

`viewport` and `materialize_graph` were verbs and went, *because the camera is addressed*. Proposing
a tile verb here is proposing to re-add `viewport` under another name, and the reason it would be
tempting is the same reason it was there the first time: it looks like the tidy place to put it.

## The architecture is three lines, and we already own two

```
draw    camera → tiles → bytes                 arithmetic, then a fetch
ask     verb → Arrow → ids                     the six verbs, or SQL
join    ids → mask over what is resident       IdSetClient + Resident
```

The third line is the one that keeps the first two from becoming two renderers, and it is the one
already built: `IdSetClient` publishes an enumerated set of ids as a clause, `Resident` turns
identities into the buffer indices cosmos.gl draws at, and the canvas sets
`highlightedPointIndices`. That is exactly the corpus' own sentence — *the algebra returns ids and
the canvas applies them as a mask over the tiles it already holds* — and we had built it without
reading it that way.

The second line has a hole already cut for it. `SliceQuery` carries
`{ kind: "neighbourhood", seeds, depth }`, and `duckBoundedSource` refuses it in as many words: *a
neighbourhood query would mean recursive joins over the whole edge table, which is the unbounded
pattern wearing a bounded interface — fossil's `expand` is the source that should answer it.* The
verb is named in our contract before anything implements it.

## What the addressing costs, and where it does not help

Measured on the million-vertex corpus, in `BENCHMARKS.md`. A pan window intersects a small fraction
of the tiles, and reading only those is worth a large multiple over handing every URL to the engine
with a `WHERE`.

**It does nothing for first paint**, and that is worth stating because it is the number a reader
looks at first. The opening view is the whole extent, every tile intersects it, and no cleverness
reads fewer bytes. What moves that number is the container and the row-group size, which the corpus
chooses. Addressing is for the camera *moving*, which is the number a reader feels.

## What a consumer has to know

One thing: where the corpus is.

The knowledge that leaked before this record was written was five conventions and about forty lines
at the call site — how tiles are named, what the chunk size is, what the edge directory is called,
which columns GraphAr uses, and why a glob cannot work over a plain HTTP origin. One of those, the
chunk size, was a constant copied by hand and it silently read a fraction of a corpus for as long as
it was stale.

None of that is the business of something that wants to draw a graph, so none of it is in the
contract. `BoundedSource` was already the right consumer surface — one method, deliberately not a
format — and what was missing was an implementation of it that speaks corpus.

## Two things it must never become

- **A second way to say what `duckBoundedSource` says.** Column names, a type index and a table name
  come from the manifest or they do not come. A corpus reader that also takes `idField` has become
  the general source with extra steps.
- **A fetch on the camera path.** The manifest and the footer boxes are read once and kept. The
  moment a camera move costs a request before it can compute a URL, `viewport` is back.
