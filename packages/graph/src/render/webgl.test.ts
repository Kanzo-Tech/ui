import { describe, expect, it } from "vitest";
import { premultiplyClear } from "./webgl";

/** A context that records what reaches the GPU, and which framebuffer is bound (`null` is the canvas). */
function context(bound: object | null) {
  const cleared: number[][] = [];
  return {
    cleared,
    bind: (framebuffer: object | null) => (bound = framebuffer),
    gl: {
      FRAMEBUFFER_BINDING: 36006 as const,
      getParameter: () => bound,
      clearColor: (...color: number[]) => void cleared.push(color),
    },
  };
}

describe("premultiplyClear", () => {
  it("clears the canvas to a colour the compositor can add: rgb at alpha 0 is transparent", () => {
    const { gl, cleared } = context(null);
    premultiplyClear(gl);
    gl.clearColor(0.98, 0.99, 0.98, 0);
    expect(cleared).toEqual([[0, 0, 0, 0]]);
  });

  it("premultiplies a translucent clear by its alpha", () => {
    const { gl, cleared } = context(null);
    premultiplyClear(gl);
    gl.clearColor(1, 0.5, 0, 0.5);
    expect(cleared).toEqual([[0.5, 0.25, 0, 0.5]]);
  });

  it("leaves an offscreen pass alone: cosmos.gl clears its textures to sentinels", () => {
    const { gl, cleared } = context({});
    premultiplyClear(gl);
    gl.clearColor(-1, 1, 0, 0);
    expect(cleared).toEqual([[-1, 1, 0, 0]]);
  });
});
