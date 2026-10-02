import type { Graph } from "@cosmos.gl/graph";

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
  /** A layout started moving the points: the corners are history, and the camera follows. */
  run(): void;
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
 */
export function createCamera(graph: Graph, host: HTMLElement): { camera: Camera; taken: (userDriven: boolean) => void } {
  let corners: readonly number[] | null = null;
  let framing = false;
  let following = false;
  let followed = 0;
  let pending = 0;

  const fitNow = (duration: number) => {
    if (corners) graph.fitViewByPointPositions([...corners], duration, FIT_PADDING);
    else graph.fitView(duration, FIT_PADDING);
  };
  const reframe = () => {
    pending = 0;
    if (framing && !following) fitNow(0);
  };
  // After cosmos.gl's own observer has resized the canvas, so the frame is taken at the new size.
  const resizes =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (!pending) pending = requestAnimationFrame(reframe);
        });
  resizes?.observe(host);
  void graph.ready.then(reframe, () => {});

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
    run() {
      corners = null;
      following = true;
      followed = performance.now();
    },
    tick() {
      const now = performance.now();
      if (!following || now - followed < FOLLOW_EVERY) return;
      followed = now;
      graph.fitView(FOLLOW_DURATION, FIT_PADDING);
    },
    settle() {
      if (following) graph.fitView(FIT_DURATION, FIT_PADDING);
      following = false;
    },
    destroy() {
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
