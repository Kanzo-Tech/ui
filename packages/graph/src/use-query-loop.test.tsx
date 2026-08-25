import { act, renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { Graph } from "@cosmos.gl/graph";
import type { BoundedSource, Slice, SliceRequest, Viewport } from "./bounded";
import { isColour } from "./graph-model";
import { useQueryLoop } from "./use-query-loop";

/**
 * The query loop, on the one thing that is a behaviour rather than a shape: **a channel is part of
 * the question.**
 *
 * `fill` and `r` reach the source through `SliceRequest`, which the compiler checks, and nothing in
 * the type system says the loop must *ask again* when one changes — that is a dependency array, and
 * a dependency array is exactly what a refactor drops in silence. Before this the columns were baked
 * into a source at construction, so recolouring meant building a second source; the whole point of
 * moving them is that it now costs one query and no rebuild.
 *
 * **What this cannot prove.** It runs against a recording source in jsdom, so it says what the loop
 * *asks* and nothing about what comes back: no SQL is built, no column is resolved, and a `fill`
 * naming a column that does not exist looks identical here to one that does. That failure surfaces
 * where it should — the query errors and `onError` says so — and the picture itself is checked in
 * the browser, where the workspace showcase draws the archive coloured by `kind`.
 */

/** An answer with nothing in it. The loop's behaviour does not depend on what came back. */
function nothing(): Slice {
  return {
    n: 0,
    marks: 0,
    vertices: new BigUint64Array(0),
    positions: new Float32Array(0),
    links: new Float32Array(0),
    categories: new Uint16Array(0),
  };
}

/** A source that answers everything and remembers what it was asked. */
function recording(total: number, box?: Viewport) {
  const asks: SliceRequest[] = [];
  const order: string[] = [];
  let counts = 0;
  const source: BoundedSource = {
    async total() {
      counts += 1;
      return total;
    },
    async slice(request) {
      order.push("slice");
      asks.push(request);
      return nothing();
    },
    ...(box
      ? {
          async extent() {
            order.push("extent");
            return box;
          },
        }
      : {}),
  };
  return { asks, counted: () => counts, order, source };
}

/**
 * Enough renderer to be asked where the camera is. The loop reads the transform off cosmos.gl rather
 * than recomputing it, so a fake that answers those two is the whole surface it touches.
 *
 * **`ready` is part of that surface and was missing**, which is how this file modelled an instance
 * that is usable the moment it exists — the exact premise the geometry push was written on. It is
 * not: cosmos.gl 3.x builds its device asynchronously, so a real instance rejects a
 * `setPointPositions` for as long as the promise is pending. `pending()` below is the fake that
 * says so.
 */
function camera(fits: number[][] = [], boxes: number[] = [], ready = Promise.resolve()): Graph {
  return {
    ready,
    getZoomLevel: () => 1,
    screenToSpacePosition: ([x, y]: [number, number]) => [x, y],
    setLinks: () => {},
    setPointPositions: () => {},
    render: () => {},
    fitViewByPointPositions: (positions: number[]) => fits.push(positions),
    setConfigPartial: (config: { spaceSize?: number }) => {
      if (config.spaceSize !== undefined) boxes.push(config.spaceSize);
    },
  } as unknown as Graph;
}

describe("a channel is part of the question", () => {
  it("re-asks with the new column, and does not count the corpus again", async () => {
    const { asks, counted, source } = recording(10);
    const graphRef = createRef<Graph | null>() as { current: Graph | null };
    const hostRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      (props: { fill: string; r?: string }) =>
        useQueryLoop({ graphRef, hostRef, limit: 1000, source, ...props }),
      { initialProps: { fill: "kind", r: "degree" } },
    );

    // Ten vertices under a limit of a thousand: taken whole, so this is the branch where the camera
    // is never consulted and a channel is the only thing that can produce a second question.
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0]?.fill).toBe("kind");
    expect(asks[0]?.r).toBe("degree");

    await act(async () => {
      rerender({ fill: "hall", r: "degree" });
    });

    await waitFor(() => expect(asks).toHaveLength(2));
    expect(asks[1]?.fill).toBe("hall");
    // The corpus did not change size because its colour did. Counting again is the cost that made
    // rebuilding a source the wrong way to recolour, and it is what splitting the two effects buys.
    expect(counted()).toBe(1);
  });

  it("re-asks through the camera when the graph is sliced", async () => {
    const { asks, counted, source } = recording(10_000);
    const graphRef = { current: camera() };
    const hostRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      (props: { fill: string }) =>
        useQueryLoop({ debounce: 0, graphRef, hostRef, limit: 100, source, ...props }),
      { initialProps: { fill: "kind" } },
    );

    // Ten thousand against a limit of a hundred: bounded, so every question is a rectangle and the
    // channel has to survive the path through `refresh` as well as the opening one.
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0]?.fill).toBe("kind");
    expect(asks[0]?.view).toBeDefined();

    await act(async () => {
      rerender({ fill: "hall" });
    });

    await waitFor(() => expect(asks.length).toBeGreaterThan(1));
    expect(asks.at(-1)?.fill).toBe("hall");
    expect(counted()).toBe(1);
  });
});

/**
 * The column a slice's one categorical array comes from, when the bindings disagree about who names
 * it.
 *
 * This is not `useQueryLoop`'s decision — it is `useGraph`'s, one layer up, where the single
 * vocabulary the caller writes splits into what the query fetches and what the buffers paint. It is
 * tested here because the loop is what receives the answer, and because the failure it prevents was
 * live for one render: `fill` as a CSS constant left the request with no column, the source fell back
 * to its own default, and DuckDB answered `Referenced column "community" not found`.
 */
describe("the column the query is asked for", () => {
  it("is the binding that names one — `symbol` when `fill` is a constant", () => {
    // `isColour` is the whole test, and the two cases it separates are what the assertion is about.
    expect(isColour("var(--foreground)")).toBe(true);
    expect(isColour("#0b0b0b")).toBe(true);
    // A bare word is always a column, which is what keeps a corpus with a column called `red` safe.
    expect(isColour("red")).toBe(false);
    expect(isColour("kind")).toBe(false);
    expect(isColour(undefined)).toBe(false);
  });
});

/**
 * Framing the opening view, which is the loop's job and was nobody's.
 *
 * The failure it replaces is measured rather than imagined: the archive occupies 1% of the space's
 * area, the camera opened on the space, and 1,543 points landed in a tenth of the viewport — every
 * one uploaded, none legible. What this cannot prove is the picture; it proves the order and the
 * rectangle, and the browser proves the rest.
 */
describe("the opening view", () => {
  const box: Viewport = { xMin: 100, yMin: 200, xMax: 300, yMax: 400 };

  it("frames the corpus before it asks anything, and only once", async () => {
    const { asks, order, source } = recording(10, box);
    const fits: number[][] = [];
    const boxes: number[] = [];
    const graphRef = { current: camera(fits, boxes) };
    const hostRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      (props: { fill: string }) =>
        useQueryLoop({ graphRef, hostRef, limit: 1000, source, ...props }),
      { initialProps: { fill: "kind" } },
    );

    await waitFor(() => expect(asks).toHaveLength(1));
    // Before, not after: a sliced graph's first question is *what is the camera over*, so framing
    // afterwards asks one query about the default box and a second about the corpus.
    expect(order).toEqual(["extent", "slice"]);
    expect(fits).toEqual([[100, 200, 300, 400]]);
    // And the box the renderer draws into is that extent's larger side, not a constant. There used
    // to be an exported `SPACE = 4096` here, which a corpus fossil wrote — spanning about
    // x ∈ [−345, 645396] — disagreed with by 157×, invisibly: `spaceSize` is a translation in every
    // cosmos.gl render path, so the wrong box changed nothing anyone could see.
    expect(boxes).toEqual([200]);

    await act(async () => {
      rerender({ fill: "hall" });
    });
    await waitFor(() => expect(asks).toHaveLength(2));
    // A reader who panned somewhere and then changed a channel is not asking to be sent home.
    expect(fits).toHaveLength(1);
  });

  it("leaves the camera alone when the source has no extent to give", async () => {
    const { asks, source } = recording(10);
    const fits: number[][] = [];
    const graphRef = { current: camera(fits) };
    const hostRef = { current: document.createElement("div") };

    renderHook(() => useQueryLoop({ graphRef, hostRef, limit: 1000, source }));

    await waitFor(() => expect(asks).toHaveLength(1));
    // Arrays with no layout have no opening view to be framed on, and guessing one is worse than
    // leaving the renderer where it started.
    expect(fits).toHaveLength(0);
  });
});

/**
 * **A non-null instance is not a usable one**, and for a while this file could not tell them apart.
 *
 * cosmos.gl 3.x builds its device asynchronously: the constructor returns, `graphRef.current` is
 * set, and for tens of milliseconds — longer with several graphs on one page — the instance rejects
 * every setter. `setPointPositions` on one throws `Cannot set properties of undefined (setting
 * 'shouldSkipRescale')`, React swallows it into the effect boundary, and what a reader gets is a
 * blank canvas beside a badge reporting a full slice with `onFailure` never called. Measured on
 * `/docs/graph`, where three graphs mount together and none of them drew.
 *
 * ## What this cannot prove
 *
 * - **The cancel is not held.** `whenReady` returns one so an effect can drop a write the next
 *   slice has already superseded, and nothing asserts it is used. A test for it was written and
 *   **deleted**: driving three pushes past a `watch` registration that the hook re-establishes
 *   between renders failed about one run in six, because the captured `push` had been released by
 *   the time it was called. A guard that is wrong one time in six is worse than none.
 *
 * - **Nothing here is a device.** The fake resolves or does not; that a real cosmos.gl instance
 *   throws before `ready` is upstream's behaviour, quoted in its own `.d.ts` for the two hit tests
 *   in the same words — *must only be called when the graph is ready*.
 * - **The hit tests are not covered.** `findPointsInRect` and `findPointsInPolygon` carry that same
 *   warning and are called from `use-graph-selection.ts` with no gate, on the argument that a
 *   gesture cannot start before the device exists. That argument is untested.
 */
describe("geometry waits for the device", () => {
  it("writes nothing into a graph whose device has not arrived", async () => {
    const { source } = recording(10);
    const wrote: number[] = [];
    let arrive: () => void = () => {};
    const graph = camera([], [], new Promise<void>((resolve) => (arrive = resolve)));
    (graph as unknown as { setPointPositions: (p: Float32Array) => void }).setPointPositions = (p) =>
      wrote.push(p.length);
    const graphRef = { current: graph };
    const hostRef = { current: document.createElement("div") };

    renderHook(() => useQueryLoop({ graphRef, hostRef, limit: 1000, source }));
    // The answer is in hand — this is not a test about the source being slow.
    await waitFor(() => expect(wrote).toHaveLength(0));

    await act(async () => {
      arrive();
    });

    expect(wrote.length).toBeGreaterThan(0);
  });

});

describe("an answer the camera did not ask for", () => {
  it("is drawn, and the watch is released with the loop", async () => {
    const { asks, source } = recording(10);
    let push: ((slice: Slice) => void) | null = null;
    let released = 0;
    const watched: BoundedSource = {
      ...source,
      watch(answered) {
        push = answered;
        return () => {
          push = null;
          released += 1;
        };
      },
    };
    const graphRef = { current: camera() };
    const hostRef = { current: document.createElement("div") };

    const { result, unmount } = renderHook(() =>
      useQueryLoop({ graphRef, hostRef, limit: 1000, source: watched }),
    );
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(push).not.toBeNull();

    const pushed = { ...nothing(), n: 7 };
    await act(async () => {
      push?.(pushed);
    });
    expect(result.current.slice).toBe(pushed);
    // Not by asking again: the coordinator already ran the reads with the new predicate.
    expect(asks).toHaveLength(1);

    unmount();
    expect(released).toBe(1);
  });
});
