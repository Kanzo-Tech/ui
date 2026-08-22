"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Graph } from "@cosmos.gl/graph";
import type { Resident, VertexId } from "./resident";
import { whenReady } from "./when-ready";

/**
 * Everything that floats over the canvas and has to keep up with it: the hub labels, the hover
 * card, and the grid's lock to the graph's own space.
 *
 * One rAF for all three, because they answer the same question — *where is the camera now* — and
 * three independent loops would read the same transform three times a frame. React never runs: the
 * overlays move by imperative style writes, and a re-render per frame would be a re-render per
 * frame.
 *
 * **An overlay is attached to a vertex, not to a slot.** Everything here outlives an answer — a
 * label element is kept across renders, a hover survives a query — so the tracked set is identities
 * and the buffer index is resolved through `Resident` at the moment of painting. Held as indices, a
 * label would keep its position and change which node it was naming the first time the resident set
 * moved, with the text and the dot disagreeing and nothing raised.
 *
 * This lived inside the canvas component among seven other concerns, and that is not a filing
 * detail: the scheduler below once kept a cancelled `requestAnimationFrame` handle in `frame`,
 * which silently disabled every overlay for the life of the page. It took a long time to find in a
 * 700-line component and would have been obvious here.
 */

/** Dot spacing at zoom 1. The painter keeps the on-screen spacing inside [GRID, 2·GRID). */
export const GRID = 22;

/** How far the hover card clears its node, and the margin it keeps from the canvas edge. */
const CARD_GAP = 14;
const CARD_EDGE = 8;

/** How far a label floats above its node, how tall its box is, and the air it demands around it. */
const LABEL_LIFT = 10;
const LABEL_HEIGHT = 12;
const LABEL_GAP = 3;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

export interface GraphOverlays {
  /** The box the overlays are positioned within — the canvas' own bounds. */
  hostRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<HTMLDivElement | null>;
  cardRef: React.RefObject<HTMLDivElement | null>;
  /** A `ref` callback for a given vertex's label. */
  labelRef: (vertex: VertexId) => (element: HTMLElement | null) => void;
  /** The labelled vertices, in the order the declutter pass should place them. */
  setLabelOrder: (vertices: VertexId[]) => void;
  setHovered: (vertex: VertexId | null) => void;
  /**
   * Re-register the tracked points with cosmos.gl.
   *
   * Call it after the graph exists and whenever the set of overlaid nodes changes. It has to be
   * driven from outside because effects run in declaration order, so this hook's own effects cannot
   * see a graph that a later hook is about to construct — and that construction is exactly what
   * clears the registration.
   */
  track: () => void;
  /** Ask for a repaint. Coalesced — many calls in a frame cost one. */
  schedule: () => void;
}

export interface GraphOverlayOptions {
  getGraph: () => Graph | null;
  /** Who is drawn right now, for turning a tracked vertex into the buffer index cosmos.gl wants. */
  getResident: () => Resident;
}

export function useGraphOverlays(options: GraphOverlayOptions): GraphOverlays {
  const { getGraph, getResident } = options;
  const hostRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef(new Map<VertexId, HTMLElement>());
  /** Label widths, measured once each — reading `offsetWidth` every frame would force layout. */
  const widths = useRef(new Map<VertexId, number>());
  const order = useRef<VertexId[]>([]);
  const hoveredRef = useRef<VertexId | null>(null);
  /** The card's box, measured once per hover, for the same reason. */
  const cardSize = useRef<{ width: number; height: number } | null>(null);
  /** The canvas' own box, kept by a `ResizeObserver` — see the effect below. */
  const box = useRef<{ width: number; height: number } | null>(null);
  const frame = useRef(0);

  /**
   * Tell cosmos.gl which points the overlays are watching: the labelled ones, plus the hovered one.
   *
   * Registration is *not* self-maintaining. `Points.updatePositions()` ends in an argument-less
   * `trackPointsByIndices()` that clears it, and that runs whenever `isPointPositionsUpdateNeeded`
   * is set — which only `setPointPositions` does. So the registration survives every look change and
   * every slider, and is lost exactly once per graph: at construction, on the `render()` that
   * follows `setPointPositions`. Hence a caller-driven re-register rather than a one-shot.
   */
  const track = useCallback(() => {
    const graph = getGraph();
    if (!graph) return;
    const hovered = hoveredRef.current;
    const watched =
      hovered === null || order.current.includes(hovered)
        ? order.current
        : [...order.current, hovered];
    // Registration is a device call like any other, and this one is *only* reached before the
    // device in the case that matters: a host registers its labels the moment the first slice
    // lands, which is the same commit the graph is still being built in. Dropped there, the
    // tracked map stays empty and every overlay sits at `opacity: 0` for ever.
    whenReady(graph, (ready) => ready.trackPointPositionsByIndices(getResident().indicesOf(watched)));
  }, [getGraph, getResident]);

  const paint = useCallback(() => {
    const graph = getGraph();
    if (!graph) return;
    const resident = getResident();
    /**
     * Positions come from the tracking API, not from `getPointPositions()`.
     *
     * The difference is what gets read back per frame. `getPointPositions()` is a synchronous
     * `readPixels` of the *whole* position framebuffer — 10,000 bytes at this corpus size, plus an
     * O(n) array build — on every animation frame the simulation runs. Tracking reads a
     * `ceil(√k)²` texture for the k points that actually carry an overlay: 576 bytes for Atlas'
     * 26 labels and a hovered node. It also caches while the simulation is stopped, so a settled
     * graph costs no readback at all until something moves.
     */
    // Read lazily: with labels off and nothing hovered, the only overlay left is the grid, which
    // needs the transform and not the points.
    let positions: ReadonlyMap<number, [number, number]> | null = null;
    /**
     * Where a vertex is on screen, or `null` when it is not drawn at all.
     *
     * Two ways to be absent and they are one answer here: not resident — the query moved on and this
     * vertex is not in the current buffers — or resident and not yet tracked. Both mean *do not draw
     * an overlay for it*, and the alternative to asking is drawing it at whatever the stale index now
     * holds, which is a label on the wrong node.
     */
    const at = (vertex: VertexId): [number, number] | null => {
      const index = resident.indexOf(vertex);
      if (index === undefined) return null;
      positions ??= graph.getTrackedPointPositionsMap();
      return positions.get(index) ?? null;
    };

    // Placed boxes, in importance order. A label that would land on one already down is dropped
    // rather than drawn over it — an unreadable pile of overlapping names is worse than a sparser
    // set of legible ones.
    const placed: [number, number, number, number][] = [];
    const bounds = box.current;
    for (const vertex of order.current) {
      const element = labelEls.current.get(vertex);
      if (!element) continue;
      const point = at(vertex);
      if (!point) {
        element.style.opacity = "0";
        continue;
      }
      const [x, y] = graph.spaceToScreenPosition(point);
      let width = widths.current.get(vertex);
      if (width === undefined) {
        width = element.offsetWidth;
        widths.current.set(vertex, width);
      }
      const x1 = x - width / 2;
      const x2 = x1 + width;
      const y2 = y - LABEL_LIFT;
      const y1 = y2 - LABEL_HEIGHT;
      const offscreen =
        bounds !== null && (x2 < 0 || y2 < 0 || x1 > bounds.width || y1 > bounds.height);
      const collides = placed.some((r) => x1 < r[2] && x2 > r[0] && y1 < r[3] && y2 > r[1]);
      if (offscreen || collides) {
        element.style.opacity = "0";
        continue;
      }
      placed.push([x1 - LABEL_GAP, y1 - LABEL_GAP, x2 + LABEL_GAP, y2 + LABEL_GAP]);
      // Positioned at the box that was just tested, in pixels. The previous version measured a
      // rectangle here and then drew the label somewhere else — `translate(-50%, -160%)` offsets by
      // percentages of the element's own size, so the collision box sat about nine pixels below the
      // text it was meant to protect and neighbouring labels overlapped anyway.
      element.style.transform = `translate(${Math.round(x1)}px, ${Math.round(y1)}px)`;
      element.style.opacity = "1";
    }
    // The grid belongs to the graph's space, not to the viewport: it slides with a pan and
    // subdivides on zoom, so the spacing on screen never leaves [GRID, 2·GRID). Without that a
    // fixed grid reads as wallpaper and the canvas stops feeling like somewhere you can move.
    const grid = gridRef.current;
    if (grid) {
      const k = graph.getZoomLevel();
      if (k > 0) {
        const step = (GRID * k) / 2 ** Math.floor(Math.log2(k));
        const [ox, oy] = graph.spaceToScreenPosition([0, 0]);
        const wrap = (v: number) => ((v % step) + step) % step;
        grid.style.backgroundSize = `${step}px ${step}px`;
        grid.style.backgroundPosition = `${wrap(ox)}px ${wrap(oy)}px`;
      }
    }

    // The card sits above the node, flips below when the top runs out, and is held inside the
    // canvas on both axes. It used to be centred with percentage transforms, which cannot know
    // about an edge — and since this layer clips, a node near a border showed half a tooltip.
    const card = cardRef.current;
    const hovered = hoveredRef.current;
    if (card && hovered !== null && bounds) {
      const point = at(hovered);
      if (point) {
        const [x, y] = graph.spaceToScreenPosition(point);
        let size = cardSize.current;
        if (!size) {
          size = { width: card.offsetWidth, height: card.offsetHeight };
          cardSize.current = size;
        }
        const above = y - CARD_GAP - size.height;
        const below = y + CARD_GAP;
        const top = above >= CARD_EDGE ? above : below;
        card.style.transform = `translate(${Math.round(
          clamp(x - size.width / 2, CARD_EDGE, bounds.width - size.width - CARD_EDGE),
        )}px, ${Math.round(clamp(top, CARD_EDGE, bounds.height - size.height - CARD_EDGE))}px)`;
        card.style.opacity = "1";
      }
    }
  }, [getGraph, getResident]);

  // The canvas' box, measured when it changes rather than when it is read. `getBoundingClientRect()`
  // inside `paint` was one forced layout per animation frame, in a painter that caches `offsetWidth`
  // for exactly that reason.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.contentRect;
      if (size) box.current = { width: size.width, height: size.height };
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      paint();
    });
  }, [paint]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      // Clearing the handle is the whole point of this cleanup, not the cancel. `frame` doubles as
      // the "a paint is already queued" flag, and StrictMode runs setup → cleanup → setup on the
      // same instance, so the refs survive. Leaving a cancelled handle behind made every later
      // `schedule()` believe a frame was still pending and return early — permanently.
      frame.current = 0;
    },
    [],
  );

  const labelRef = useCallback(
    (vertex: VertexId) => (element: HTMLElement | null) => {
      if (element) labelEls.current.set(vertex, element);
      else labelEls.current.delete(vertex);
    },
    [],
  );

  const setLabelOrder = useCallback((vertices: VertexId[]) => {
    order.current = vertices;
    widths.current.clear();
  }, []);

  const setHovered = useCallback((vertex: VertexId | null) => {
    hoveredRef.current = vertex;
    cardSize.current = null;
  }, []);

  return { hostRef, gridRef, cardRef, labelRef, setLabelOrder, setHovered, track, schedule };
}
