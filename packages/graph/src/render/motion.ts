import { visibleOf } from "../core/kept";
import type { Geometry } from "../core/load";
import type { GraphOptions } from "../core/state";

/**
 * **What the renderer decides from the data**, apart from cosmos.gl so it can be read and tested
 * without a GPU: how long a layout cools, when it hides links, whether it runs, and which links a filter
 * or a pick leaves in full colour.
 */

/**
 * How long a layout cools, in frames: cosmos.gl's alpha reaches its floor after exactly this many.
 * Measured on the gate in `/docs/graph/layout`: the shape is done in one to three seconds at every
 * size, so a layout that runs on is spending frames, not reaching a better picture — 600 settles
 * 200,000 vertices in about ten seconds at sixty frames, and past that 240 does the same at half the
 * frame rate.
 */
export const decayFor = (size: number): number => (size > 200_000 ? 240 : 600);
/**
 * Past this many links a running layout does not draw them: drawing them is the cost, not the
 * forces — at 800,000 links a layout ticked 14 times a second with them and 51 without (the gate).
 * They come back when it settles.
 */
export const LINKS_WHILE_RUNNING = 250_000;

/** Whether a layout should run: as `simulate` says, else exactly when the positions are not the data's. */
export const simulating = (options: GraphOptions, geometry: Geometry | null): boolean =>
  options.simulate ?? (geometry !== null && !geometry.bound);

/**
 * `visibleOf` said to cosmos.gl, which greys links apart from points, so the links are said out loud:
 * those whose two ends are both in full colour.
 */
export function highlighted(
  geometry: Geometry,
  mask: Uint8Array | null,
  selection: readonly number[] | null,
): { highlightedPointIndices: number[] | undefined; highlightedLinkIndices: number[] | undefined } {
  const points = visibleOf(geometry.size, mask, selection);
  if (points === null) return { highlightedPointIndices: undefined, highlightedLinkIndices: undefined };
  const on = new Uint8Array(geometry.size);
  for (const id of points) on[id] = 1;
  const linkIds: number[] = [];
  const { links } = geometry;
  for (let e = 0; e < links.length / 2; e++) if (on[links[2 * e] as number] && on[links[2 * e + 1] as number]) linkIds.push(e);
  return { highlightedPointIndices: points, highlightedLinkIndices: linkIds };
}
