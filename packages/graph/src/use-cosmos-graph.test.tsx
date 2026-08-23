import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCosmosGraph } from "./use-cosmos-graph.js";

/**
 * **The context is a resource with a hard budget, and this holds the two things we owe it.**
 *
 * A browser keeps a limited number of live WebGL contexts — sixteen per renderer in Chrome,
 * measured — and **evicts the oldest** rather than refusing a new one. Eviction raises nothing: the
 * canvas stops painting, `getPointPositions()` reads back empty, `getZoomLevel()` answers zero, and
 * every setter keeps accepting arrays. Measured on `/docs/graph`, where three of four canvases sat
 * at `isContextLost === true` with a badge beside each reporting a full slice — and the renderer had
 * **fifteen free slots at the time**, because the loss happened during the load and nothing brings a
 * context back.
 *
 * So: release ours when the graph goes (`loseContext` appears **zero times** in
 * `@cosmos.gl/graph@3.4.0`, so nobody else will), and say something when one is lost.
 *
 * ## What these cannot prove, and it is most of it
 *
 * - **jsdom has no WebGL at all**, so `hasWebGL()` declines before a graph is ever constructed. The
 *   cleanup path and the listener therefore cannot be *run* here. Two tests that faked a canvas and
 *   asserted a reimplementation of the hook's own lines were written and deleted: a test that
 *   copies the code it is testing passes when the code is deleted, which is the opposite of a
 *   guard. What replaces them is a **source scan** — weak, and it fails when somebody removes the
 *   release, which is the failure that actually happened.
 * - **Nothing counts contexts.** The sixteen, the eviction order and the fifteen free slots are
 *   browser behaviour measured once by hand and written into `use-cosmos-graph.ts`.
 * - **Nothing rebuilds after a restore.** `preventDefault()` asks the browser to try, and we do not
 *   listen for `webglcontextrestored` — re-uploading every buffer needs a slice this hook does not
 *   hold. The graph stays blank; it just stops being blank *and silent*.
 */

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "use-cosmos-graph.ts"),
  "utf8",
);

describe("useCosmosGraph", () => {
  it("declines in an environment with no WebGL, and says so once", () => {
    // jsdom is that environment, which makes this the one claim about the hook itself that can be
    // made here — and it is the claim that keeps `onFailure` from being silent, which is the
    // difference between an empty box and an empty box that explains itself.
    const onFailure = vi.fn();
    const graphRef = { current: null };
    const hostRef = { current: document.createElement("div") };

    renderHook(() => useCosmosGraph({ graphRef, hostRef, onFailure }));

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(String(onFailure.mock.calls[0]?.[0])).toMatch(/WebGL/i);
    expect(graphRef.current).toBeNull();
  });

  it("does not rebuild the renderer because a callback changed identity", () => {
    // **The test the whole bug fits through, and jsdom can run it.** `hasWebGL()` declines here, so
    // the construction effect's *only* observable act is one `onFailure`. If the callbacks are in
    // the dependency list, a re-render with a fresh inline arrow re-runs the effect and the count
    // goes up — which in a browser is a `destroy()` and a new WebGL context instead.
    //
    // Measured before the fix, on `/docs/graph` with nobody touching the page: 142 destroys in five
    // seconds, `setPointPositions` called zero times, and `getGraph()` answering a different
    // instance each time. `onFailure={(e) => setFailure(e)}` is the obvious spelling and every
    // consumer writes it.
    const calls: string[] = [];
    const graphRef = { current: null };
    const hostRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      ({ tag }: { tag: string }) =>
        useCosmosGraph({
          graphRef,
          hostRef,
          // A new function on every render, which is the point.
          onFailure: (message: string) => calls.push(`${tag}:${message}`),
        }),
      { initialProps: { tag: "a" } },
    );
    expect(calls).toHaveLength(1);

    rerender({ tag: "b" });
    rerender({ tag: "c" });

    expect(calls).toHaveLength(1);
  });

  it("calls the newest callback, not the one it was built with", () => {
    // The other half of holding them in a ref: held wrongly, a graph built on the first render
    // would report failures to a closure three renders stale. Only the lost-context path can show
    // this in jsdom — the decline fires once, at construction — so it is asserted through the
    // source instead, and named here rather than left implied.
    expect(SOURCE).toContain("callbacks.current.onFailure");
    expect(SOURCE).toContain("callbacks.current.report");
    expect(SOURCE).not.toMatch(/\n\s+onFailure\(/);
  });

  it("gives the context back when the graph goes", () => {
    // Two halves, and the order between them is the part worth pinning: `destroy()` frees cosmos.gl's
    // buffers, and the release has to come after so it is not freeing a context still in use.
    expect(SOURCE).toContain("WEBGL_lose_context");
    expect(SOURCE).toContain("releaseContext(canvas)");
    expect(SOURCE.indexOf("graph.destroy()")).toBeLessThan(SOURCE.indexOf("releaseContext(canvas)"));
    // And the element is read in the cleanup, not remembered from construction — it does not exist
    // until the device does, which is how the first version of this released nothing at all.
    expect(SOURCE).toMatch(/const canvas = host\.querySelector\("canvas"\);\n\s+canvas\?\.removeEventListener/);
  });

  it("hears a lost context and asks for a restore", () => {
    expect(SOURCE).toContain('addEventListener("webglcontextlost"');
    // Inside `whenReady`, for the same reason: there is no canvas to listen on before the device.
    expect(SOURCE).toMatch(/whenReady\(graph, \(\) => \{\n\s+host\.querySelector\("canvas"\)\?\.addEventListener/);
    // Without `preventDefault()` there is no `webglcontextrestored` event to hear, ever — the
    // browser does not attempt a restore for a loss nobody objected to.
    expect(SOURCE).toContain("event.preventDefault()");
    // And the listener comes off with the graph: one per mount, never one per mount plus the last.
    expect(SOURCE).toContain('removeEventListener("webglcontextlost"');
  });
});
