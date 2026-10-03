import type { Graph } from "@cosmos.gl/graph";
import { GraphError } from "../core/error";
import type { View } from "../core/state";

export const FIT_DURATION = 420;
const FIT_PADDING = 0.18;
/** How often a running layout re-frames the camera, and how long each re-frame glides. */
const FOLLOW_EVERY = 900;
const FOLLOW_DURATION = 700;

export interface Camera {
  /** A corpus was placed: frame these corners now, and again whenever the canvas changes size. */
  frame(corners: readonly number[]): void;
  /** The reader asked for the whole graph: frame it, and keep it framed through a resize. */
  fit(): void;
  /** A canvas before this one left the camera here: look there again, as a camera the reader holds. */
  restore(view: View): void;
  /** Where the camera looks now, read at the canvas's size; `null` with no size to read a centre from. */
  view(width: number, height: number): View | null;
  /** A layout started moving the points: the corners are history, and the camera follows. */
  run(): void;
  /** cosmos.gl's device came up: the frame is taken again, at the canvas's size. */
  ready(): void;
  /** cosmos.gl was handed positions and rendered them: from now on a fit may read them back. */
  drawn(): void;
  tick(): void;
  settle(): void;
  destroy(): void;
}

/**
 * **Who holds the camera, and when it gives it back.** The camera frames the corpus once it is
 * placed and keeps it framed — through cosmos.gl's device coming up and every resize of the canvas,
 * since a host's split panel settles its width after mount and a frame taken at the old size opens
 * zoomed into a corner — and while a layout runs it follows the moving points and frames them when
 * they settle: Cosmograph's fit-on-settle, kept up. All of it stops the moment the reader zooms or
 * pans, and comes back with Fit or the next run.
 *
 * **A fit without corners reads the points back from the GPU** (`fitView` → `getPointPositions` →
 * `readPixels` of cosmos.gl's position framebuffer), so it waits until there is one to read: the
 * device is up and a render has uploaded positions. If the read throws anyway, cosmos.gl holds no
 * positions: that is `graph/no-positions`, reported once through `fail`, and the camera reads no more
 * — rather than the same exception on every tick of a layout over a blank canvas.
 */
export function createCamera(
  graph: Graph,
  host: HTMLElement,
  fail: (error: GraphError) => void,
): { camera: Camera; taken: (userDriven: boolean) => void } {
  let corners: readonly number[] | null = null;
  let framing = false;
  let following = false;
  let followed = 0;
  let pending = 0;
  let drawn = false;
  let broken = false;
  let gone = false;

  const fitPoints = (duration: number) => {
    if (!drawn || broken || !graph.isReady) return;
    try {
      graph.fitView(duration, FIT_PADDING);
    } catch (error) {
      broken = true;
      following = false;
      fail(new GraphError("graph/no-positions", "cosmos.gl holds no positions on the GPU to draw or frame.", {}, { cause: error }));
    }
  };
  const fitNow = (duration: number) => {
    if (corners) graph.fitViewByPointPositions([...corners], duration, FIT_PADDING);
    else fitPoints(duration);
  };
  const reframe = () => {
    pending = 0;
    if (framing && !following) fitNow(0);
  };
  const later = () => {
    if (!pending && !gone) pending = requestAnimationFrame(reframe);
  };
  // After cosmos.gl's own observer has resized the canvas, so the frame is taken at the new size.
  const resizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
  resizes?.observe(host);

  const camera: Camera = {
    frame(next) {
      corners = next;
      framing = true;
      fitNow(0);
    },
    fit() {
      framing = true;
      fitNow(FIT_DURATION);
    },
    restore({ center, zoom }) {
      corners = null;
      framing = following = false;
      graph.setZoomTransformByPointPositions(new Float32Array(center), 0, zoom);
    },
    view(width, height) {
      if (width === 0 || height === 0) return null;
      return { center: graph.screenToSpacePosition([width / 2, height / 2]), zoom: graph.getZoomLevel() };
    },
    run() {
      corners = null;
      following = true;
      followed = performance.now();
    },
    // A frame later: the commands cosmos.gl queued for its device run in the same turn as this.
    ready: later,
    drawn() {
      drawn = true;
    },
    tick() {
      const now = performance.now();
      if (!following || now - followed < FOLLOW_EVERY) return;
      followed = now;
      fitPoints(FOLLOW_DURATION);
    },
    settle() {
      if (following) fitPoints(FIT_DURATION);
      following = false;
    },
    destroy() {
      gone = true;
      resizes?.disconnect();
      if (pending) cancelAnimationFrame(pending);
    },
  };
  const taken = (userDriven: boolean) => {
    if (!userDriven) return;
    framing = false;
    following = false;
  };
  return { camera, taken };
}
