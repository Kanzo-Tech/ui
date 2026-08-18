# A dense id is thirty-two bits

- **Status** live — 2026-08-14
- **Decided** `VertexId` packs `(type_idx, dense_id)` as `type << 32 | dense`, so a `dense_id` above
  2³²−1 is not representable and a type index above 2³²−1 is not either. `denseOf` and `typeOf`
  return `number`, which holds 32 bits exactly.
- **Because** it is what the writer emits: `Node.vertex.yml` declares the column as an unsigned word
  of exactly this width, verified on a corpus this repository built. So the ceiling is an agreement
  with fossil rather than an assumption we made and forgot.
- **Reversed by** a corpus whose manifest declares a `dense_id` wider than the packing holds, or a
  vertex type count past the same bound. Either makes the packing lossy in silence, which is the one
  failure this shape was chosen to prevent.
- **Held by** `packages/graph/src/resident.ts`, `TYPE_SHIFT` / `DENSE_MASK`;
  `packages/graph/src/resident.test.ts`, "round-trips the pair exactly at the top of the dense
  range"; `packages/graph/src/resident.test.ts`, "round-trips the far corner of the whole 64-bit
  range, which a float64 could not".

## The gap this record exists to name

The corpus's own page is **wider than we are**. `conventions/identity` says a `dense_id` is «an
unsigned integer that may carry more than 53 bits», and publishes border vectors at 2³¹ and 2⁵³ for
exactly the reason a narrower reader is a bug that still looks right — those are the two places a
port that got it wrong gives a different answer.

So the page permits 64 bits and we permit 32. Today that is not a conflict, because the writer emits
`uint32` and the two agree in practice. It becomes one the moment fossil widens the column, and the
symptom would be silent: `BigInt(dense)` above 2³² overflows into the type field, so vertex
`(0, 2³²)` and vertex `(1, 0)` become one identity, a selection points at the wrong node, and
nothing raises.

Recorded rather than fixed, because widening now costs the thing the current packing buys. `typeOf`
and `denseOf` return `number` and a `number` holds 32 bits **exactly** — no rounding, no
`BigInt`-to-`Number` conversion that can lose a digit at the boundary. A 40/24 or a 48/16 split
keeps the 64-bit total but puts one half past 2⁵³ arithmetic in the general case, and then every
accessor has to hand back a `bigint` and every call site that indexes an array has to convert. That
is a real cost paid against a ceiling nobody is near.

## What would make this cheap to change

One place. `TYPE_SHIFT` and `DENSE_MASK` are the whole of the packing, and `vertexId` / `typeOf` /
`denseOf` are the only readers of them. Nothing else in the package looks inside a `VertexId` — that
is what the opaque `bigint & brand` is for, and `resident.test.ts` asserts the round trip at the far
corner. The migration is those two constants and the accessors' return type.

## What it does not touch

- **The `bigint` decision itself, which is settled and is not this one.** A `VertexId` is a `bigint`
  because a 64-bit value crossing into JavaScript is the failure that recurs across every
  multi-language format surveyed — `mapbox/node-s2` is a *binding* and still returned wrong cell ids.
  Narrowing the *fields* does not narrow the *carrier*: the pair is still one 64-bit integer, still a
  primitive type error against a buffer index, still immune to `>>` meaning three different things.
- **A reserved type index, if there is ever another one.** `SUPERNODE` was `0xffff`, worn by the
  super-nodes of the aggregate far view so a group and a vertex could not share an identity; it went
  with that branch — `decisions/a-far-view-is-a-sample-not-a-summary.md`. Whatever replaces it lives
  in the type half and is unaffected by how the dense half is sized, which is the part of this that
  was never about `SUPERNODE`.
