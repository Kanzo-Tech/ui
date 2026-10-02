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
