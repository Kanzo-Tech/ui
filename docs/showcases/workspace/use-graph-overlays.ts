"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Graph } from "@cosmos.gl/graph";

/**
 * Everything that floats over the canvas and has to keep up with it: the hub labels, the hover
 * card, and the grid's lock to the graph's own space.
 *
 * One rAF for all three, because they answer the same question — *where is the camera now* — and
 * three independent loops would read the same transform three times a frame. React never runs: the
 * overlays move by imperative style writes, and a re-render per frame would be a re-render per
 * frame.
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
  /** A `ref` callback for the label of a given node index. */
  labelRef: (index: number) => (element: HTMLElement | null) => void;
  /** The labelled indices, in the order the declutter pass should place them. */
  setLabelOrder: (indices: number[]) => void;
  setHovered: (index: number | null) => void;
  /** Ask for a repaint. Coalesced — many calls in a frame cost one. */
  schedule: () => void;
}

export function useGraphOverlays(getGraph: () => Graph | null): GraphOverlays {
  const hostRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef(new Map<number, HTMLElement>());
  /** Label widths, measured once each — reading `offsetWidth` every frame would force layout. */
  const widths = useRef(new Map<number, number>());
  const order = useRef<number[]>([]);
  const hoveredRef = useRef<number | null>(null);
  /** The card's box, measured once per hover, for the same reason. */
  const cardSize = useRef<{ width: number; height: number } | null>(null);
  const frame = useRef(0);

  const paint = useCallback(() => {
    const graph = getGraph();
    if (!graph) return;
    /**
     * Positions come from `getPointPositions()`, not from cosmos.gl's tracking API.
     *
     * Tracking looked like the right tool — register the handful of indices you care about, read
     * back a small texture — but it keeps hidden state that the library itself destroys: rebuilding
     * the point buffers ends in an internal `trackPointsByIndices()` with no argument, which clears
     * the registration outright. Every `setPointColors` / `setPointSizes` silently unsubscribed us,
     * so labels froze the first time anyone touched a look or a slider.
     *
     * This reads the whole position framebuffer instead. One `readPixels` of a 25×25 texture at
     * this corpus size, no registration to lose, and nothing to keep in sync. It reads *every*
     * point rather than the labelled few, which is the trade — fine here, and the thing to revisit
     * long before this canvas reaches a hundred thousand nodes.
     */
    // Read lazily: with labels off and nothing hovered, the only overlay left is the grid, which
    // needs the transform and not the points.
    let positions: number[] | null = null;
    const at = (index: number): [number, number] | null => {
      positions ??= graph.getPointPositions();
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];
      return x === undefined || y === undefined ? null : [x, y];
    };

    // Placed boxes, in importance order. A label that would land on one already down is dropped
    // rather than drawn over it — an unreadable pile of overlapping names is worse than a sparser
    // set of legible ones.
    const placed: [number, number, number, number][] = [];
    const box = hostRef.current?.getBoundingClientRect();
    for (const index of order.current) {
      const element = labelEls.current.get(index);
      if (!element) continue;
      const point = at(index);
      if (!point) {
        element.style.opacity = "0";
        continue;
      }
      const [x, y] = graph.spaceToScreenPosition(point);
      let width = widths.current.get(index);
      if (width === undefined) {
        width = element.offsetWidth;
        widths.current.set(index, width);
      }
      const x1 = x - width / 2;
      const x2 = x1 + width;
      const y2 = y - LABEL_LIFT;
      const y1 = y2 - LABEL_HEIGHT;
      const offscreen =
        box !== undefined && (x2 < 0 || y2 < 0 || x1 > box.width || y1 > box.height);
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
    const hoveredIndex = hoveredRef.current;
    if (card && hoveredIndex !== null && box) {
      const point = at(hoveredIndex);
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
          clamp(x - size.width / 2, CARD_EDGE, box.width - size.width - CARD_EDGE),
        )}px, ${Math.round(clamp(top, CARD_EDGE, box.height - size.height - CARD_EDGE))}px)`;
        card.style.opacity = "1";
      }
    }
  }, [getGraph]);

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
    (index: number) => (element: HTMLElement | null) => {
      if (element) labelEls.current.set(index, element);
      else labelEls.current.delete(index);
    },
    [],
  );

  const setLabelOrder = useCallback((indices: number[]) => {
    order.current = indices;
    widths.current.clear();
  }, []);

  const setHovered = useCallback((index: number | null) => {
    hoveredRef.current = index;
    cardSize.current = null;
  }, []);

  return { hostRef, gridRef, cardRef, labelRef, setLabelOrder, setHovered, schedule };
}
