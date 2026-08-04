import type { Display, Sim } from "./types";

/**
 * How a graph of *this size* should be drawn — force coefficients and two render
 * switches, interpolated continuously against node count.
 *
 * Absorbed from `@fossil-lang/viewer`'s `getAdaptiveConfig` per ADR-0040, which files it under
 * "level-of-detail policy". Reading it, that is not quite what it is, and the difference matters:
 * almost all of it is **simulation tuning** — repulsion, friction, spring, gravity — plus two
 * genuinely render-side switches. Level of detail in the bounded sense is `lodThreshold` and the
 * source's aggregate mode, which live in `bounded.ts` and are a different mechanism entirely.
 *
 * That means most of this only applies under `simulate: true`, which ADR-0001 made the opt-in case.
 * It is still worth having: the host with arrays in hand and no precomputed layout is exactly the
 * host that runs a live simulation, and one set of production-tuned numbers beats each call site
 * inventing its own.
 *
 * **The continuous interpolation is the design**, not an implementation detail. Breakpoints snap —
 * a graph crossing 10,000 nodes would visibly jump — and Cosmograph 1.x is the cautionary example.
 * The constants are tuned across 10 to 100,000 nodes and divergence from them is a defect.
 */

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp(t, 0, 1);

/** `0` at about ten nodes, `1` at about a hundred thousand — log₁₀, because node counts are. */
function scaleOfCount(nodes: number): number {
  return clamp((Math.log10(Math.max(nodes, 1)) - 1) / 4, 0, 1);
}

/**
 * The coefficients and the drawing options a graph this size wants.
 *
 * Returned together because they are one judgement asked of one number, and splitting them into two
 * exports that must be called with the same argument is how they drift apart. The caller still keeps
 * them apart downstream — `Sim` rebuilds nothing and `Display` is uniforms — which is the split that
 * actually costs something.
 *
 * **`spaceSize` is deliberately not here.** The original scaled the simulation box from 2,048 to
 * 8,192 with the corpus, which is coherent when a layout is computed on the fly and incoherent once
 * positions are authority: the box is the coordinate space a source's positions are expressed in and
 * a spatial query is asked against, so resizing it by node count would move the index under the
 * camera. `SPACE` is one number for that reason.
 */
export function adaptive(nodes: number): { sim: Sim; display: Pick<Display, "links" | "pointScale"> } {
  const t = scaleOfCount(nodes);
  return {
    sim: {
      // Bigger graphs need less push and more damping, or they never settle.
      repulsion: lerp(1.2, 0.4, t),
      friction: lerp(0.7, 0.92, t),
      linkSpring: lerp(0.5, 0.25, t),
      linkDistance: lerp(30, 12, t),
      gravity: lerp(0.35, 0.08, t),
      cluster: 0.15,
    },
    display: {
      // Past a quarter of a million links the edge layer is fog, and fog costs a draw call per
      // frame to render. Below it, links are most of what a reader is actually looking at.
      links: nodes < 250_000,
      pointScale: lerp(1.5, 0.5, t),
    },
  };
}
