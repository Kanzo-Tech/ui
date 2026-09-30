/**
 * Whether this browser can run the renderer at all. cosmos.gl draws its own message rather than
 * throwing, and under 3.x `graph.ready` never settles when no device can be made — so the probe
 * answers the common case before either can happen.
 */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return probe.getContext("webgl2") !== null || probe.getContext("webgl") !== null;
  } catch {
    return false;
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
