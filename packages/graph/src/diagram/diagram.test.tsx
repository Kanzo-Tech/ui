import { createRequire } from "node:module";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as DIAGRAM from "../diagram";
import { DiagramCanvas, DiagramControls, DiagramRoot, type DiagramEdge } from "../diagram";
import { layered } from "./layout";

// Counted, not replaced: ELK is deterministic, so a second run over the same boxes lands every node
// where the first did, and only the count tells a run that did not happen from one that changed nothing.
vi.mock("./layout", async (load) => {
  const actual = await load<typeof import("./layout")>();
  return { ...actual, layered: vi.fn(actual.layered) };
});

/**
 * The diagram over React Flow and ELK, in jsdom: what is laid out where, when the layout runs and
 * when it does not, and what a click and a key mean.
 *
 * **What jsdom cannot do, and what stands in for it.** It lays nothing out, so every element measures
 * 120 × 40 and a `ResizeObserver` answers once, as a browser's first observation does; React Flow
 * measures a node from those. It runs no worker, so `Worker` is ELK's own in-thread stand-in, the one
 * `elkjs` hands Node — the same layout code, without the thread. So these hold the order and the
 * stability of the layout, never a pixel of it, and nothing about the worker's file reaching a page:
 * the docs build is what bundles that.
 */
const ElkWorker = (createRequire(import.meta.url)("elkjs/lib/elk-worker.min.js") as { Worker: new () => Worker }).Worker;

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private watching = new Set<Element>();
      constructor(private readonly answer: ResizeObserverCallback) {}
      observe(target: Element) {
        this.watching.add(target);
        queueMicrotask(() => {
          if (this.watching.has(target)) this.answer([{ target, contentRect: { width: 120, height: 40 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
        });
      }
      unobserve(target: Element) {
        this.watching.delete(target);
      }
      disconnect() {
        this.watching.clear();
      }
    },
  );
  // React Flow reads the zoom off the viewport's transform; `m22` is the only field it asks for.
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      readonly m22: number;
      constructor(transform?: string) {
        this.m22 = Number(/scale\(([\d.]+)\)/.exec(transform ?? "")?.[1] ?? 1);
      }
    },
  );
  vi.stubGlobal("Worker", ElkWorker);
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 120 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 40 });
});

afterAll(() => {
  vi.unstubAllGlobals();
  // Back to jsdom's own, which answer 0: the prototype is shared with every other file in the worker.
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

const CHAIN: DiagramEdge[] = [
  { id: "a-b", source: "a", target: "b", label: "won by" },
  { id: "b-c", source: "b", target: "c", label: "born in" },
];

function Diagram({
  nodes = ["a", "b", "c"],
  edges = CHAIN,
  orientation,
  selected,
  onSelect,
  onFailure = () => {
    throw new Error("the layout failed");
  },
  word = "count",
}: Partial<React.ComponentProps<typeof DiagramRoot>> & { word?: string }) {
  return (
    <DiagramRoot edges={edges} nodes={nodes} onFailure={onFailure} onSelect={onSelect} orientation={orientation} selected={selected}>
      <DiagramCanvas>
        {(id, state) => (
          <div data-selected={state.selected || undefined}>
            {id} {word}
            <button type="button">?</button>
          </div>
        )}
      </DiagramCanvas>
      <DiagramControls />
    </DiagramRoot>
  );
}

const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;

/** Where a node was put: React Flow writes it as the node's transform. */
function at(id: string): [number, number] {
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(node(id).style.transform);
  if (!match) throw new Error(`${id} has no position`);
  return [Number(match[1]), Number(match[2])];
}

const placed = (...ids: string[]) =>
  waitFor(() => {
    for (const id of ids) expect(node(id)?.className, id).not.toContain("invisible");
  });

describe("the diagram's surface", () => {
  it("is exactly this list", () => {
    expect(Object.keys(DIAGRAM).sort()).toEqual(["DiagramCanvas", "DiagramControls", "DiagramRoot"]);
  });
});

describe("the layout", () => {
  it("lays a chain out in layers along its edges, across or down", async () => {
    const { unmount } = render(<Diagram />);
    await placed("a", "b", "c");
    expect(at("a")[0]).toBeLessThan(at("b")[0]);
    expect(at("b")[0]).toBeLessThan(at("c")[0]);
    unmount();

    render(<Diagram orientation="vertical" />);
    await placed("a", "b", "c");
    expect(at("a")[1]).toBeLessThan(at("b")[1]);
    expect(at("b")[1]).toBeLessThan(at("c")[1]);
  });

  it("keeps every node where it is when a label or a node's contents change", async () => {
    const { rerender } = render(<Diagram />);
    await placed("a", "b", "c");
    const before = ["a", "b", "c"].map(at);
    vi.mocked(layered).mockClear();
    rerender(<Diagram edges={CHAIN.map((edge) => ({ ...edge, label: `${edge.label}, again` }))} word="twelve" />);
    await screen.findByText("won by, again");
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(["a", "b", "c"].map(at)).toEqual(before);
    expect(layered).not.toHaveBeenCalled();
  });

  it("lays out again when a node arrives, and places it after the one it hangs from", async () => {
    const { rerender } = render(<Diagram />);
    await placed("a", "b", "c");
    rerender(<Diagram edges={[...CHAIN, { id: "c-d", source: "c", target: "d" }]} nodes={["a", "b", "c", "d"]} />);
    await placed("d");
    await waitFor(() => expect(at("d")[0]).toBeGreaterThan(at("c")[0]));
  });

  it("lays out the new set when one node replaces another, not the set it replaced", async () => {
    const { rerender } = render(<Diagram />);
    await placed("a", "b", "c");
    rerender(<Diagram edges={[CHAIN[0]!, { id: "b-d", source: "b", target: "d" }]} nodes={["a", "b", "d"]} />);
    await placed("d");
    expect(at("d")[0]).toBeGreaterThan(at("b")[0]);
  });

  it("draws an edge's label, and no edge whose end is not a node", async () => {
    render(<Diagram edges={[...CHAIN, { id: "c-x", source: "c", target: "x", label: "nowhere" }]} />);
    await placed("a", "b", "c");
    expect(screen.getByText("won by")).toBeTruthy();
    expect(screen.queryByText("nowhere")).toBeNull();
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(2);
  });
});

describe("a failure", () => {
  it("reaches the host as thrown, and leaves the nodes unplaced rather than piled at the origin", async () => {
    const blocked = new Error("worker-src refused the layout's worker");
    vi.mocked(layered).mockRejectedValueOnce(blocked);
    const onFailure = vi.fn();
    render(<Diagram onFailure={onFailure} />);
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith(blocked));
    expect(node("a").className).toContain("invisible");
  });
});

describe("selection", () => {
  it("selects a node on a click and on Enter, clears it with Escape and on the pane, and says so", async () => {
    const onSelect = vi.fn();
    render(<Diagram onSelect={onSelect} />);
    await placed("a", "b", "c");
    const user = userEvent.setup();

    // `fireEvent`, not `user.click`: d3-zoom's mousedown reads `event.view`, which user-event leaves null.
    fireEvent.click(within(node("b")).getByText(/count/));
    expect(onSelect).toHaveBeenLastCalledWith("b");
    expect(node("b").querySelector("[data-selected]")).not.toBeNull();

    node("c").focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("c");

    await user.keyboard("{Escape}");
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(document.querySelector("[data-selected]")).toBeNull();

    fireEvent.click(within(node("a")).getByText(/count/));
    expect(onSelect).toHaveBeenLastCalledWith("a");
    fireEvent.click(document.querySelector(".react-flow__pane")!);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("draws the host's selection and nothing else when it is controlled", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Diagram onSelect={onSelect} selected="a" />);
    await placed("a", "b", "c");
    expect(node("a").querySelector("[data-selected]")).not.toBeNull();

    fireEvent.click(within(node("b")).getByText(/count/));
    expect(onSelect).toHaveBeenLastCalledWith("b");
    expect(node("b").querySelector("[data-selected]"), "the host has not answered yet").toBeNull();

    rerender(<Diagram onSelect={onSelect} selected="b" />);
    expect(node("b").querySelector("[data-selected]")).not.toBeNull();
    expect(node("a").querySelector("[data-selected]")).toBeNull();
  });

  // A click inside a node bubbles to it and selects it, as React Flow means; a marker that should not
  // select stops its click. A key is the case the canvas owns: without the `nokey` wrapper, Enter on
  // the marker would select the node however the host handled the click.
  it("leaves a key pressed on a button inside a node to the button", async () => {
    const pressed = vi.fn();
    const onSelect = vi.fn();
    function Marked() {
      const [count, setCount] = useState(0);
      return (
        <DiagramRoot edges={CHAIN} nodes={["a", "b", "c"]} onFailure={() => {}} onSelect={onSelect}>
          <DiagramCanvas>
            {(id) => (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  pressed(id);
                  setCount(count + 1);
                }}
                type="button"
              >
                {id}?
              </button>
            )}
          </DiagramCanvas>
        </DiagramRoot>
      );
    }
    render(<Marked />);
    await placed("a", "b", "c");
    screen.getByText("b?").focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(pressed).toHaveBeenCalledWith("b");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("the controls", () => {
  it("are a named group of three named buttons", async () => {
    render(<Diagram />);
    const group = screen.getByRole("group", { name: "Camera" });
    for (const name of ["Zoom in", "Zoom out", "Fit the diagram"]) {
      expect(group.contains(screen.getByRole("button", { name }))).toBe(true);
    }
    await placed("a", "b", "c");
  });
});
