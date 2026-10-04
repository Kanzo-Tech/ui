"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readTitles } from "../core/source";
import type { Graph } from "@cosmos.gl/graph";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphState } from "../react/use-graph-state";
import type { LabelLevel } from "../render/graph-looks";

/**
 * **Which points carry a label, and their text** — Cosmograph's label model, where no level is an
 * unbounded set: `showTopLabelsLimit`, `showDynamicLabelsLimit`, and culling by overlap.
 *
 * Top's and Visible's budgets are Cosmograph 2.5's own defaults, 150 and 100, read from its
 * `config/defaults.js` (its JSDoc says 30 for both; the code is what runs). All has no count of its
 * own: it is every point of the view's sample, and the sample is bounded by the screen — one point
 * per `CELL` square, so a view holds at most `cellsIn` of them whatever the graph's size. A level
 * that once meant *every vertex* sorted, mounted, tracked and read the title of 327k of them.
 */
const TOP_LABELS = 150;
const VISIBLE_LABELS = 100;

/** cosmos.gl's `pointSamplingDistance` default, which the renderer does not override. */
const CELL = 100;

/** How long the camera has to be still before the view is sampled again. */
const REST = 160;

const NONE: readonly VertexId[] = [];

/** The most sample points a `width` × `height` view can hold: cosmos.gl's grid, one per cell. */
export const cellsIn = (width: number, height: number): number => Math.ceil(width / CELL) * Math.ceil(height / CELL);

function* every(size: number): Generator<VertexId> {
  for (let id = 0; id < size; id++) yield id;
}

/**
 * The biggest `budget` surviving vertices of `among`, biggest first. One pass, keeping the best few
 * in order: a sort of every vertex to name a hundred and fifty of them is the cost this avoids.
 */
function biggest(among: Iterable<VertexId>, ramp: Float32Array, mask: Uint8Array | null, budget: number): VertexId[] {
  const best: VertexId[] = [];
  for (const id of among) {
    const value = ramp[id] as number;
    if ((mask && !mask[id]) || Number.isNaN(value)) continue;
    if (best.length === budget && value <= (ramp[best[budget - 1] as number] as number)) continue;
    let at = best.length;
    while (at > 0 && (ramp[best[at - 1] as number] as number) < value) at--;
    best.splice(at, 0, id);
    if (best.length > budget) best.pop();
  }
  return best;
}

/** Top's vertices: the graph's biggest, independent of the camera, so a pan never recounts them. */
export const topOf = (level: LabelLevel, size: number, ramp: Float32Array, mask: Uint8Array | null): VertexId[] =>
  level === "none" || level === "hovered" ? [] : biggest(every(size), ramp, mask, TOP_LABELS);

/**
 * The vertices a level labels, in the order the declutter pass places them — so where two collide,
 * the bigger point keeps its name. Each level adds to the one before; the focused vertex leads from
 * Hovered up, and Hovered's own label is the hover card, which is not a tracked label. Bounded by
 * construction: `top`, plus at most `inView`, plus the focus.
 */
export function labelled(
  level: LabelLevel,
  size: number,
  ramp: Float32Array,
  top: readonly VertexId[],
  mask: Uint8Array | null,
  inView: readonly VertexId[],
  focus: VertexId | null,
): VertexId[] {
  let ids = [...top];
  if (level === "visible" || level === "all") {
    const seen = new Set(top);
    const rest = inView.filter((id) => id < size && !seen.has(id));
    // All keeps a point with no size value, which is still a point; Visible ranks, so it cannot.
    const added = level === "all" ? rest.filter((id) => !mask || mask[id]) : biggest(rest, ramp, mask, VISIBLE_LABELS);
    ids = [...ids, ...added].sort((a, b) => ((ramp[b] as number) || 0) - ((ramp[a] as number) || 0));
  }
  if (level === "none" || focus === null || focus >= size) return ids;
  return [focus, ...ids.filter((id) => id !== focus)];
}

/**
 * **The view's sample: what cosmos.gl says is in view**, one point per `CELL` — the call
 * Cosmograph's dynamic labels make, and never more points than `cellsIn` the surface. A sample is a
 * GPU pass and a readback, so it is taken when the camera has rested for `REST`, not on every frame;
 * while a layout runs, the last sample's labels follow their points through the overlays' tracking.
 * `moved` is stable for the canvas's life, which is what lets the renderer's `onFrame` call it.
 */
export function useInView(
  getGraph: () => Graph | null,
  surface: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): { inView: readonly VertexId[]; moved: () => void } {
  const [inView, setInView] = useState<readonly VertexId[]>(NONE);
  const wanted = useRef(enabled);
  const timer = useRef(0);
  const moved = useCallback(() => {
    if (!wanted.current) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const graph = getGraph();
      const box = surface.current;
      if (!graph || !box) return;
      const sampled = [...graph.getSampledPointPositionsMap().keys()].slice(0, cellsIn(box.clientWidth, box.clientHeight));
      setInView((last) => (last.length === sampled.length && last.every((id, i) => id === sampled[i]) ? last : sampled));
    }, REST);
  }, [getGraph, surface]);
  useEffect(() => {
    wanted.current = enabled;
    if (enabled) moved();
    else setInView(NONE);
    return () => clearTimeout(timer.current);
  }, [enabled, moved]);
  return { inView, moved };
}

/**
 * A label's text is read for the vertices that carry one, never carried for every vertex. The read
 * is keyed on the array's identity — the caller memoizes it — not on a string of its ids.
 */
export function useTitles(vertices: readonly VertexId[]): ReadonlyMap<VertexId, string> {
  const api = useGraphContext();
  const structure = useGraphState((s) => s.structure);
  const title = useGraphState((s) => s.options.title);
  const coordinator = useGraphState((s) => s.options.coordinator);
  const [titles, setTitles] = useState<ReadonlyMap<VertexId, string>>(() => new Map());
  useEffect(() => {
    if (!structure || !coordinator || vertices.length === 0) return;
    let current = true;
    readTitles(coordinator, structure, vertices, title).then(
      (found) => current && setTitles(found),
      (error: unknown) => current && api.getState().options.onFailure(error),
    );
    return () => {
      current = false;
    };
  }, [api, structure, coordinator, vertices, title]);
  return titles;
}
