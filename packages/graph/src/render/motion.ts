import { bindingOf } from "../core/channels";
import { idsOf } from "../core/kept";
import { carries, type Geometry } from "../core/load";
import type { GraphOptions } from "../core/state";
import type { Structure } from "../core/structure";

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

/**
 * **Whether the data places the points**: `x` and `y` both bound to columns the graph carries — what
 * `loadGeometry` binds positions by, read from the options as soon as they change, before the
 * geometry they ask for has loaded (so binding the second axis stops a running layout at once), or a
 * geometry already placed by them. Then no layout runs, whatever asks for one: forces over positions
 * that are data only push them against the square's walls.
 */
export function placedByData(options: GraphOptions, { structure, geometry }: { structure: Structure | null; geometry?: Geometry | null }): boolean {
  const { x, y } = bindingOf(options);
  return geometry?.bound === true || (structure !== null && carries(structure, x) && carries(structure, y));
}

/** Whether a layout should run: never over the data's positions; else as `simulate` says, running by default. */
export const simulating = (options: GraphOptions, geometry: Geometry | null): boolean =>
  geometry !== null && !geometry.bound && (options.simulate ?? true);

/**
 * What is kept, said to cosmos.gl, which greys links apart from points, so the links are said out
 * loud: those whose two ends are both kept.
 */
export function highlighted(
  geometry: Geometry,
  kept: Uint8Array | null,
): { highlightedPointIndices: number[] | undefined; highlightedLinkIndices: number[] | undefined } {
  const points = idsOf(kept);
  if (points === null || kept === null) return { highlightedPointIndices: undefined, highlightedLinkIndices: undefined };
  const linkIds: number[] = [];
  const { links } = geometry;
  for (let e = 0; e < links.length / 2; e++) if (kept[links[2 * e] as number] && kept[links[2 * e + 1] as number]) linkIds.push(e);
  return { highlightedPointIndices: points, highlightedLinkIndices: linkIds };
}
