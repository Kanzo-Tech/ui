"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { Graph } from "@cosmos.gl/graph";
import type { Resident, VertexId } from "./resident";
import type { Selection, SelectionSource, Tool } from "./types";
import { isReady } from "./when-ready";

/**
 * Drawing a selection on the canvas: the marquee, the lasso, and the keys that modify them.
 *
 * The whole gesture lives here — what is being drawn, how many nodes it currently holds, and what
 * happens when the pointer comes up. The component gets handlers to spread onto an overlay and the
 * state to draw it with; it does not need to know that Shift borrows the marquee or that a hit test
 * costs a GPU readback.
 *
 * Modifiers are read at *release*, not at press, because that is when the reader has decided:
 * `Alt` removes what was drawn from the selection, `⌘`/`Ctrl` adds it, and neither replaces.
 */
export type Point = [number, number];

/** A selection gesture in flight. The two tools differ only in what they accumulate. */
export type Drag = { tool: "rect"; from: Point; to: Point } | { tool: "lasso"; path: Point[] };

/** Below this the hit test would be answering about a click, not a box. */
const MIN_RECT = 3;
/** A raw pointer stream makes a polygon of near-duplicate vertices; the hit test walks every one. */
const PATH_STEP = 4;
/** Slower than the hand, faster than the eye — and one GPU readback per gesture frame is plenty. */
const MEASURE_MS = 60;

/** The running count rides just off the cursor, at the edge the gesture is growing from. */
export function cursorChip(drag: Drag | null): React.CSSProperties {
  if (!drag) return { display: "none" };
  const [x = 0, y = 0] = drag.tool === "rect" ? drag.to : (drag.path[drag.path.length - 1] ?? []);
  return { left: x + 14, top: y + 14 };
}

export interface GraphSelectionGesture {
  /** The gesture being drawn, for the overlay to render. */
  drag: Drag | null;
  /** How many nodes it holds right now, so the number lands before the mouse does. */
  preview: number | null;
  /** The tool actually in force: the chosen one, or the marquee Shift is lending. */
  active: Tool;
  handlers: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerCancel: () => void;
  };
}

export interface GraphSelectionOptions {
  getGraph: () => Graph | null;
  /**
   * Who is drawn right now — the only thing that can turn a hit-test index into an identity.
   *
   * A gesture selects positions on screen, and a position is a buffer index, which the next
   * residency reuses for a different vertex. So the gesture resolves to identities here and now,
   * while the answer that produced them is still the one on screen.
   */
  getResident: () => Resident;
  /** The live selection, for the modifiers to add to or subtract from. */
  getSelection: () => Selection | null;
  commit: (vertices: Set<VertexId> | null, source: SelectionSource, label: string) => void;
  tool: Tool;
  setTool: (tool: Tool) => void;
}

const NAME: Record<"rect" | "lasso", { source: SelectionSource; label: string }> = {
  rect: { source: "marquee", label: "Marquee" },
  lasso: { source: "lasso", label: "Lasso" },
};

export function useGraphSelection(options: GraphSelectionOptions): GraphSelectionGesture {
  const { commit, getGraph, getResident, getSelection, setTool, tool } = options;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [shift, setShift] = useState(false);
  const measured = useRef(0);

  const hitTest = useCallback(
    (shape: Drag): number[] => {
      const graph = getGraph();
      if (!graph) return [];
      // **Upstream's own words, on these two and on nothing else in its `.d.ts`:** *this method is
      // synchronous and must only be called when the graph is ready*. There is nothing to await in
      // a pointer handler, so the answer for a device that is not there is the honest one — a
      // gesture over a graph that has not drawn selects nothing, which is what it looks like.
      if (!isReady(graph)) return [];
      if (shape.tool === "rect") {
        const [[ax, ay], [bx, by]] = [shape.from, shape.to];
        if (Math.abs(bx - ax) < MIN_RECT || Math.abs(by - ay) < MIN_RECT) return [];
        return Array.from(
          graph.findPointsInRect([
            [Math.min(ax, bx), Math.min(ay, by)],
            [Math.max(ax, bx), Math.max(ay, by)],
          ]),
        );
      }
      if (shape.path.length < 3) return [];
      return Array.from(graph.findPointsInPolygon(shape.path));
    },
    [getGraph],
  );

  // Both hit tests are a GPU pass followed by a synchronous `readPixels`, so running one per
  // pointer event would stall the frame the gesture is being drawn into.
  const measure = useCallback(
    (shape: Drag) => {
      const now = performance.now();
      if (now - measured.current < MEASURE_MS) return;
      measured.current = now;
      setPreview(hitTest(shape).length);
    },
    [hitTest],
  );

  // Escape is the way out of everything, in layers: it abandons a drag in progress, then drops the
  // tool, then clears what is held. And a window that loses focus never delivers the Shift keyup,
  // which would leave the canvas unable to pan.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShift(true);
      if (event.key !== "Escape") return;
      setDrag((current) => {
        if (current) return null;
        if (tool) setTool(null);
        else commit(null, "node", "");
        return null;
      });
      setPreview(null);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShift(false);
    };
    const blur = () => setShift(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [commit, setTool, tool]);

  /** Screen coordinates inside the canvas — the space every cosmos.gl hit test speaks. */
  const at = (event: React.PointerEvent): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };

  const finish = (shape: Drag | null, event: React.PointerEvent) => {
    setDrag(null);
    setPreview(null);
    if (!shape) return;
    // The one line the whole gesture turns on: the hit test answers in buffer indices, and they stop
    // meaning anything the moment the resident set changes.
    const vertices = new Set(getResident().verticesAt(hitTest(shape)));
    // A gesture that caught nothing and asked for nothing is a misfire, not a request to clear —
    // clearing is what the corner's own button and Escape are for.
    if (vertices.size === 0 && !event.altKey) return;
    const { label, source } = NAME[shape.tool];
    const held = getSelection()?.vertices ?? [];
    if (event.altKey) {
      const next = new Set(held);
      for (const vertex of vertices) next.delete(vertex);
      commit(next.size > 0 ? next : null, source, label);
    } else if (event.metaKey || event.ctrlKey) {
      commit(new Set([...held, ...vertices]), source, label);
    } else {
      commit(vertices, source, label);
    }
  };

  const active: Tool = tool ?? (shift ? "rect" : null);

  return {
    drag,
    preview,
    active,
    handlers: {
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const start = at(event);
        setDrag(
          active === "rect"
            ? { tool: "rect", from: start, to: start }
            : { tool: "lasso", path: [start] },
        );
      },
      onPointerMove: (event) => {
        if (!drag) return;
        const next = at(event);
        if (drag.tool === "rect") {
          const shape: Drag = { ...drag, to: next };
          setDrag(shape);
          measure(shape);
          return;
        }
        const last = drag.path[drag.path.length - 1] as Point;
        if (Math.hypot(next[0] - last[0], next[1] - last[1]) < PATH_STEP) return;
        const shape: Drag = { tool: "lasso", path: [...drag.path, next] };
        setDrag(shape);
        measure(shape);
      },
      onPointerUp: (event) => finish(drag, event),
      onPointerCancel: () => {
        setDrag(null);
        setPreview(null);
      },
    },
  };
}
