import type { Graph } from "@cosmos.gl/graph";
import { GraphError } from "../core/error";

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
 * **A canvas's device, from the wait for it to giving it back.** `ready` never settles when cosmos.gl
 * cannot make a device, so the deadline is what ends the wait: `graph/no-webgl`, with `data.after`.
 * A lost context is `graph/context-lost`. The answer lets the device go — cosmos.gl's graph, then the
 * context it does not give back itself.
 */
export function holdDevice(graph: Graph, host: HTMLElement, fail: (error: GraphError) => void, ready: () => void): () => void {
  let gone = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    fail(new GraphError("graph/context-lost", "The browser took back the WebGL context; reload to get one."));
  };
  const noDevice = (data: GraphError["data"], cause?: unknown) =>
    fail(new GraphError("graph/no-webgl", "No GPU device came up to draw with.", data, { cause }));
  const deadline = setTimeout(() => noDevice({ after: READY_DEADLINE }), READY_DEADLINE);
  void graph.ready.then(
    () => {
      clearTimeout(deadline);
      if (gone) return;
      host.querySelector("canvas")?.addEventListener("webglcontextlost", onLost);
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
