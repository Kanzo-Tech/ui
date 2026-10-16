import type { Graph } from "@cosmos.gl/graph";
import type { Geometry } from "../core/load";
import { placementOf } from "../render/placement";

/**
 * **Where the canvas draws, said on its element** — as Observable Plot puts `scale(channel)` on the
 * output it drew: `screenOf(vertex)` and `screenAt({ x, y })`, in pixels from the canvas's top-left
 * corner, from cosmos.gl's own `spaceToScreenPosition`. What a WebGL canvas knows and its DOM does not,
 * read by whoever holds the element — `@kanzo-tech/testing`'s `GraphCanvasHarness` lassos *over
 * Madrid* with it rather than at a share of the canvas's width. Always there, in every page: nothing
 * looks for a test. Before the canvas has drawn, both answer `NaN`.
 *
 * Data reaches space through the renderer's placement, which is rebuilt here from the extent and the
 * `spaceSize` the renderer gave cosmos.gl — `placementOf` maps a side back to the same `k`, since the
 * side is the extent's longest edge times `k`. A layout that binds neither `x` nor `y` has no data
 * coordinates, and its space is what a point means.
 */
export interface Placed {
  screenOf(vertex: number): [number, number];
  screenAt(point: { x: number; y: number }): [number, number];
}

/** Puts {@link Placed}'s two answers on `element`, and takes them off again. */
export function place(element: HTMLElement, graph: () => Graph | null, geometry: () => Geometry | null): () => void {
  const nowhere: [number, number] = [Number.NaN, Number.NaN];
  const placed: Placed = {
    screenOf(vertex) {
      const drawn = graph();
      const positions = drawn?.getPointPositions() ?? [];
      const [x, y] = [positions[vertex * 2], positions[vertex * 2 + 1]];
      return drawn && x !== undefined && y !== undefined ? drawn.spaceToScreenPosition([x, y]) : nowhere;
    },
    screenAt({ x, y }) {
      const drawn = graph();
      if (!drawn) return nowhere;
      const extent = geometry()?.extent;
      if (!extent) return drawn.spaceToScreenPosition([x, y]);
      const at = placementOf(extent, drawn.config.spaceSize);
      return drawn.spaceToScreenPosition([x * at.k + at.dx, y * at.k + at.dy]);
    },
  };
  Object.assign(element, placed);
  return () => {
    const own = element as HTMLElement & Partial<Placed>;
    if (own.screenOf === placed.screenOf) delete own.screenOf;
    if (own.screenAt === placed.screenAt) delete own.screenAt;
  };
}
