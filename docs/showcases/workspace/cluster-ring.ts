import { SPACE } from "./graph-model";

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
 * That separation is the one thing the CPU seed in `lib/force-layout` cannot supply here. A `theme`
 * is an attribute, not a community: keywords are shared across themes by construction, so the link
 * structure genuinely crosses them and no link-driven layout can pull them apart. Measured on this
 * corpus, the seed's own angular hint decays from a 2.40 between/within centroid ratio at tick 0 to
 * **0.66 by tick 50**, where it stays through tick 400 — 8-nearest-neighbour purity 17.1%, against
 * a 13.2% chance floor for these eight group sizes. The seed buys short edges; only this buys
 * communities.
 */
export function clusterRing(clusters: readonly (number | undefined)[]): number[] {
  let count = 0;
  for (const slot of clusters) {
    if (slot !== undefined && slot + 1 > count) count = slot + 1;
  }
  const positions: number[] = [];
  for (let slot = 0; slot < count; slot++) {
    const angle = (slot / count) * 2 * Math.PI;
    positions.push(SPACE / 2 + Math.cos(angle) * RING, SPACE / 2 + Math.sin(angle) * RING);
  }
  return positions;
}

/**
 * How far out the ring sits, in the simulation's own units.
 *
 * Matched to where the seeded layout already lives rather than chosen for the picture: the shipped
 * seed puts nodes at a median radius of 587 from the centre of the 4,096 box, quartiles 381 and
 * 786. At 655 the ring lands between the median and the upper quartile, so the cluster force
 * redistributes points around a circle the layout already occupies instead of inflating it.
 *
 * Slot order is the order the group values were first seen in the relation, which on a ring means
 * neighbouring slots are neighbouring arcs. Nothing reads meaning into that adjacency, and nothing
 * should — the order is the relation's, not the domain's.
 */
const RING = SPACE * 0.16;
