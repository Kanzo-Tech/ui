import type { Graph } from "@cosmos.gl/graph";
import type { GraphProbe, KanzoTestingHook } from "@kanzo-tech/testing";
import type { Geometry } from "../core/load";
import { placementOf } from "../render/placement";

/**
 * **Registers a canvas with `@kanzo-tech/testing`'s hook, when a test installed one**, and does
 * nothing otherwise: production never defines `window.__KANZO_TESTING__`. What it answers is
 * cosmos.gl's own `spaceToScreenPosition`, so a harness lassos *over Madrid* rather than at a share
 * of the canvas's width; before the canvas has drawn, it answers `NaN`.
 *
 * Data reaches space through the renderer's placement, which is rebuilt here from the extent and the
 * `spaceSize` the renderer gave cosmos.gl — `placementOf` maps a side back to the same `k`, since the
 * side is the extent's longest edge times `k`. A layout that binds neither `x` nor `y` has no data
 * coordinates, and its space is what a point means.
 */
export function registerForTesting(id: string, graph: () => Graph | null, geometry: () => Geometry | null): () => void {
  const hook = (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
  if (!hook) return () => {};
  const nowhere: [number, number] = [Number.NaN, Number.NaN];
  const probe: GraphProbe = {
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
  hook.graphs.set(id, probe);
  return () => {
    if (hook.graphs.get(id) === probe) hook.graphs.delete(id);
  };
}
