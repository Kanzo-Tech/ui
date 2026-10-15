"use client";

import type { Graph } from "@cosmos.gl/graph";
import { Problem, type ProblemData } from "@kanzo-tech/kernel";

/**
 * The slowest honest answer for a GPU device: one comes up in milliseconds when it can be made at
 * all, so ten seconds is a device that will not come, not one that is slow.
 */
const READY_DEADLINE = 10_000;

/**
 * **The largest square cosmos.gl will simulate in, or `null` with no WebGL at all.** cosmos.gl draws its
 * own message rather than throwing, and under 3.x `graph.ready` never settles when no device can be
 * made — so the probe answers the common case before either can happen. The box is half the device's
 * `MAX_TEXTURE_SIZE`, the bound cosmos.gl reduces `spaceSize` to; `Infinity` where the probe cannot say.
 */
export function webglBox(): number | null {
  if (typeof document === "undefined") return null;
  try {
    const probe = document.createElement("canvas");
    const gl: Partial<WebGLRenderingContext> | null = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return null;
    const max = Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE as number)) / 2;
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return max > 0 ? max : Infinity;
  } catch {
    return null;
  }
}

/**
 * **Give the WebGL context back, because cosmos.gl does not.** `WEBGL_lose_context` appears zero times
 * in `@cosmos.gl/graph@3.4.0`, and Chrome keeps sixteen contexts per renderer process and evicts the
 * oldest without an error: `/docs/graph` mounts four graphs under StrictMode and three of them
 * measured `isContextLost === true` before this existed.
 */
export function releaseContext(canvas: HTMLCanvasElement | null): void {
  const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
  if (gl && !gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
}

/**
 * **Clear the canvas to a colour the compositor can add: `[r, g, b, 0]` becomes `[0, 0, 0, 0]`.**
 * cosmos.gl clears to `backgroundColor`, and `appearance` sets that to the page's colour at alpha 0
 * so the grid can lie under the points, on a context whose `premultipliedAlpha` is `true`. A pixel
 * with `rgb` above `alpha` is not a colour, and the compositor adds it to what lies beneath — a
 * light page measured white. cosmos.gl reads the same `backgroundColor` to grey a point out (towards
 * the page, which way by its luminance), so the colour cannot be changed there without changing the
 * greyed look; the clear is premultiplied where it is applied instead. Only the canvas's own
 * framebuffer is: cosmos.gl's offscreen passes clear to sentinels such as `[-1, 1, 0, 0]`.
 */
export function premultiplyClear(gl: Pick<WebGL2RenderingContext, "clearColor" | "getParameter" | "FRAMEBUFFER_BINDING">): void {
  const set = gl.clearColor.bind(gl);
  gl.clearColor = (r, g, b, a) => (gl.getParameter(gl.FRAMEBUFFER_BINDING) === null ? set(r * a, g * a, b * a, a) : set(r, g, b, a));
}

/**
 * **A canvas's device, from the wait for it to giving it back.** `ready` never settles when cosmos.gl
 * cannot make a device, so the deadline is what ends the wait: `graph/no-webgl`, with `data.after`.
 * A lost context is `graph/context-lost`. The answer lets the device go — cosmos.gl's graph, then the
 * context it does not give back itself.
 */
export function holdDevice(graph: Graph, host: HTMLElement, fail: (error: Problem) => void, ready: () => void): () => void {
  let gone = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    fail(new Problem("graph/context-lost", "The browser took back the WebGL context; reload to get one."));
  };
  const noDevice = (data: ProblemData<"graph/no-webgl">, cause?: unknown) =>
    fail(new Problem("graph/no-webgl", "No GPU device came up to draw with.", data, { cause }));
  const deadline = setTimeout(() => noDevice({ after: READY_DEADLINE }), READY_DEADLINE);
  void graph.ready.then(
    () => {
      clearTimeout(deadline);
      if (gone) return;
      const canvas = host.querySelector("canvas");
      canvas?.addEventListener("webglcontextlost", onLost);
      const gl = canvas?.getContext("webgl2");
      if (gl) premultiplyClear(gl);
      ready();
    },
    (error: unknown) => {
      clearTimeout(deadline);
      noDevice({}, error);
    },
  );
  return () => {
    gone = true;
    clearTimeout(deadline);
    // Read here rather than remembered from construction: the element exists only with the device.
    const canvas = host.querySelector("canvas");
    canvas?.removeEventListener("webglcontextlost", onLost);
    graph.destroy();
    releaseContext(canvas);
  };
}
