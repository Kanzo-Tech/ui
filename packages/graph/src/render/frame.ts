import type { GraphOptions, GraphSnapshot } from "../core/state";
import { placedByData, simulating } from "./motion";

/**
 * **What the renderer does, and in what order, decided apart from cosmos.gl.** `renderer.ts` is the
 * one adapter that carries the operations out; this decides them from what changed, so the order
 * cosmos.gl depends on is read and tested here without a GPU.
 */

/** What is waiting for the next frame, by kind of buffer. */
export interface Dirty {
  positions: boolean;
  paint: boolean;
  state: boolean;
}

/** One frame's operations, in the order they run. */
export type FrameOp = "positions" | "links" | "paint" | "state" | "render" | "layout" | "drawn";

/** What the frame finds: whether the store has a geometry and an encoding, and whether the geometry's links are not the ones uploaded. */
export interface FrameInputs {
  geometry: boolean;
  encoding: boolean;
  newLinks: boolean;
}

/**
 * One frame: positions wait for the first colours, so a graph's first frame is the drawn one; new
 * links repaint and restate; one `render()`, and only for an upload; the layout after it, because
 * cosmos.gl 3.4 turning its simulation on drops an upload no render has made.
 */
export function planFrame(dirty: Dirty, { geometry, encoding, newLinks }: FrameInputs): { ops: FrameOp[]; dirty: Dirty } {
  const ops: FrameOp[] = [];
  const next = { ...dirty };
  const placing = next.positions && geometry && encoding;
  if (placing) {
    next.positions = false;
    ops.push("positions");
    if (newLinks) {
      ops.push("links");
      next.paint = next.state = true;
    }
  }
  const painting = next.paint && geometry && encoding;
  if (painting) {
    next.paint = false;
    ops.push("paint");
  }
  if (next.state && geometry) {
    next.state = false;
    ops.push("state");
  }
  if (painting || placing) ops.push("render");
  if (placing) ops.push("layout");
  if (geometry && encoding && !next.paint) ops.push("drawn");
  return { ops, dirty: next };
}

export interface Seen {
  snapshot: GraphSnapshot;
  options: GraphOptions;
}

/** What a change asks of the renderer at once, in order: resolve the look, apply the forces, run or pause the layout. */
export type ChangeOp = "look" | "forces" | "run" | "pause";

/**
 * A notification from the store, as dirty flags for the next frame and what cannot wait for it.
 * `moving` is whether a layout is moving the points: binding the second axis pauses it at once,
 * before the geometry it asks for lands. A `simulate` that flips over the same geometry runs or
 * pauses it; over a new one, the frame's `layout` decides.
 */
export function planChange(prev: Seen, next: Seen, moving: boolean): { dirty: Dirty; ops: ChangeOp[] } {
  const [was, now] = [prev.snapshot, next.snapshot];
  const [before, after] = [prev.options, next.options];
  const look = after.look !== before.look;
  const dirty: Dirty = {
    positions: now.geometry !== was.geometry,
    paint: now.encoding !== was.encoding || look || after.fill !== before.fill || after.symbol !== before.symbol || after.stroke !== before.stroke,
    state: now.selection !== was.selection || now.focus !== was.focus || now.kept !== was.kept,
  };
  const ops: ChangeOp[] = [];
  if (look) ops.push("look");
  if (after.sim !== before.sim) ops.push("forces");
  if (moving && placedByData(after, now) && !placedByData(before, was)) ops.push("pause");
  const wants = simulating(after, now.geometry);
  if (now.geometry === was.geometry && wants !== simulating(before, was.geometry)) ops.push(wants ? "run" : "pause");
  return { dirty, ops };
}
