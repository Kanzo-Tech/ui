/**
 * Where each cluster sits, as a ring around the middle of the simulation box.
 *
 * `setPointClusters` on its own does not separate anything. cosmos.gl's cluster force reads a
 * cluster's position from `clusterPositionsTexture` and falls back to the group's **centre of
 * mass** when that position is negative — so without this the force pulls every node toward its own
 * group's centroid, which is cohesion toward a target that moves with the thing it is pulling.
 * Groups that start overlapped have overlapping centroids, and nothing in a purely attractive force
 * asks them to move apart. Given explicit positions the same force becomes a positional constraint,
 * and the separation is a fixed geometry the simulation converges onto rather than an emergent
 * property it might not find.
 *
 * That separation is the one thing the CPU seed in `lib/force-layout` cannot supply here. A `hall`
 * is an attribute, not a community: members, tags, beasts and regions are shared across the halls by
 * construction — a party borrows, a beast ranges, a tag is the board's and not one hall's — so the
 * link structure genuinely crosses them and no link-driven layout can pull them apart. Measured on
 * the archive corpus (1,543 nodes, 4,280 edges, five halls), the seed's own angular hint decays from
 * a 2.53 between/within centroid ratio at tick 0 to 2.73 at tick 5 and **0.71 by tick 50**, where it
 * stays: 0.67 at the shipped 200 ticks and 0.68 at 400. On the layout as shipped, 8-nearest-
 * neighbour purity is 27.0% against a 20.1% chance floor for these five group sizes. The seed buys
 * short edges — mean edge length 0.111 of the layout's width, against 0.516 for an unseeded start —
 * and only this buys communities.
 */
export function clusterRing(clusters: readonly (number | undefined)[], space: number): number[] {
  let count = 0;
  for (const slot of clusters) {
    if (slot !== undefined && slot + 1 > count) count = slot + 1;
  }
  const positions: number[] = [];
  for (let slot = 0; slot < count; slot++) {
    const angle = (slot / count) * 2 * Math.PI;
    const ring = space * RING;
    positions.push(space / 2 + Math.cos(angle) * ring, space / 2 + Math.sin(angle) * ring);
  }
  return positions;
}

/**
 * How far out the ring sits, as a **fraction of the box the renderer is working in** — which is why
 * `clusterRing` is handed that box rather than reading a constant. There is no `SPACE` any more: the
 * coordinate space belongs to whatever wrote the positions, and the one place that can still answer
 * it is the live renderer.
 *
 * Matched to where the seeded layout already lives rather than chosen for the picture, and
 * re-measured for the archive: the shipped seed puts nodes at a median radius of 351 from the centre
 * of the 4,096 box, quartiles 211 and 655. At 492 — 0.12 of that box — the ring lands between the
 * median and the upper quartile, so the cluster force redistributes points around a circle the
 * layout already occupies instead of inflating it. It was `0.16` — 655 — for the old corpus, whose
 * median sat at 587; this one packs tighter, because 938 of its 1,543 vertices are leaves hanging
 * off a contract. **The figures are against a 4,096 box**; the fraction is what survives a different
 * one, and it is a fraction for that reason.
 *
 * Slot order is the order the group values were first seen in the relation, which on a ring means
 * neighbouring slots are neighbouring arcs. Nothing reads meaning into that adjacency, and nothing
 * should — the order is the relation's, not the domain's.
 */
const RING = 0.12;
