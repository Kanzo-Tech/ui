import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { GraphRoot, useGraphContext } from "../react/graph-root";
import { internalsOf, type GraphApi } from "../react/use-graph";
import { GraphCanvas } from "./graph-canvas";
import { GraphInspector } from "./graph-inspector";
import { GraphLegend } from "./graph-legend";
import { GraphToolbar } from "./graph-toolbar";
import { useOverlays } from "./overlays";

vi.mock("./overlays", async (actual) => {
  const module = await actual<typeof import("./overlays")>();
  return { ...module, useOverlays: vi.fn(module.useOverlays) };
});

/**
 * The parts over a root with no renderer — jsdom has no WebGL — which is enough to see what each
 * reads off the context, what it draws, and which command it calls.
 */

function Hold({ into }: { into: { api: GraphApi | null } }) {
  into.api = useGraphContext();
  return null;
}

describe("GraphLegend", () => {
  it("draws the domain before the graph has loaded, named by the root", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot categories={{ 0: "Amber", 3: "Salt" }} corpus={corpus} fill="cluster_id" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["Amber—", "Salt—"]);
    expect(screen.getByText("— of 16 drawn")).toBeTruthy();
  });

  it("draws the vertex types when nothing is bound, with what each has drawn", async () => {
    const fake = fakeCorpus();
    render(
      <GraphRoot corpus={fake.corpus} onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    await act(() => fake.settle());
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["Person10", "Place6"]);
    expect(screen.getByText("16 of 16 drawn")).toBeTruthy();
  });

  it("draws no rows when colour is a constant and nothing carries a category", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} fill="var(--foreground)" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("GraphToolbar", () => {
  it("arms a tool and disarms it, through the root's state", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphToolbar />
      </GraphRoot>,
    );
    const lasso = screen.getByRole("button", { name: "Lasso" });
    fireEvent.click(lasso);
    expect(lasso.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(lasso);
    expect(lasso.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the selection, and clears it", () => {
    const { corpus } = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphToolbar />
        <Hold into={held} />
      </GraphRoot>,
    );
    expect(screen.queryByRole("group", { name: "Current selection" })).toBeNull();
    act(() => held.api?.select([1, 2], "order", "Two"));
    expect(screen.getByRole("group", { name: "Current selection" }).textContent).toContain("2 of 16 selected");
    fireEvent.click(screen.getByRole("button", { name: "Clear the selection" }));
    expect(screen.queryByRole("group", { name: "Current selection" })).toBeNull();
  });

  it("offers to run the layout without a simulate prop", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphToolbar />
      </GraphRoot>,
    );
    const layout = screen.getByRole("group", { name: "Layout" });
    expect(layout.querySelector('[aria-label="Run the layout"]')).toBeTruthy();
  });
});

describe("GraphInspector", () => {
  it("reads the focused vertex's row, and draws a host's extra fields after the corpus's own", async () => {
    const fake = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    const extra = vi.fn((detail: { fields: readonly { name: string; value: unknown }[] }) => (
      <p data-testid="extra">degree plus one: {Number(detail.fields.find((f) => f.name === "degree")?.value) + 1}</p>
    ));
    render(
      <GraphRoot corpus={fake.corpus} fill="cluster_id" onFailure={() => {}}>
        <GraphInspector>{extra}</GraphInspector>
        <Hold into={held} />
      </GraphRoot>,
    );
    expect(screen.getByText("Click a vertex on the canvas to inspect it.")).toBeTruthy();
    await act(() => fake.settle());
    act(() => held.api?.setFocus(6));
    await act(() => fake.settle());
    await waitFor(() => expect(screen.getByTestId("extra").textContent).toBe("degree plus one: 8"));
    const labels = [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(labels).toEqual(["subject", "cluster_id", "degree"]);
    expect(fake.scans.at(-1)).toMatchObject({ table: "Person", filter: { column: "dense_id", op: "=", value: 6 } });
  });
});

describe("GraphInspector's two answers", () => {
  async function inspecting() {
    const fake = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    const onFailure = vi.fn();
    render(
      <GraphRoot corpus={fake.corpus} onFailure={onFailure}>
        <GraphInspector />
        <Hold into={held} />
      </GraphRoot>,
    );
    await act(() => fake.settle());
    return { fake, held, onFailure };
  }

  it("says a vertex is not in the corpus, and reports nothing", async () => {
    const { held, onFailure } = await inspecting();
    act(() => held.api?.setFocus(99));
    await waitFor(() => expect(screen.getByText("This vertex is not in the corpus.")).toBeTruthy());
    expect(screen.queryByText("This vertex could not be read.")).toBeNull();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("says a vertex could not be read, and hands onFailure the thrown value", async () => {
    const { fake, held, onFailure } = await inspecting();
    act(() => held.api?.setFocus(6));
    const refused = Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });
    await act(async () => fake.reads.at(-1)?.reject(refused));
    await waitFor(() => expect(screen.getByText("This vertex could not be read.")).toBeTruthy());
    expect(screen.queryByText("This vertex is not in the corpus.")).toBeNull();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(refused);
  });
});

describe("GraphCanvas", () => {
  it("hands onFailure the thrown value when a label's read rejects", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const fake = fakeCorpus();
    const onFailure = vi.fn();
    render(
      <GraphRoot corpus={fake.corpus} onFailure={onFailure} r="degree">
        <GraphCanvas />
      </GraphRoot>,
    );
    const refused = Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });
    const isTitles = (read: (typeof fake.reads)[number]) => read.params.filter !== undefined && "values" in read.params.filter;
    await act(async () => {
      for (let round = 0; round < 20; round++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        for (const read of fake.reads.filter((r) => !r.released && !r.signal?.aborted)) {
          if (isTitles(read)) read.reject(refused);
          else read.release();
        }
      }
    });
    expect(fake.reads.some(isTitles)).toBe(true);
    expect(onFailure.mock.calls.map(([error]) => error)).toContain(refused);
    vi.unstubAllGlobals();
  });


  it("re-renders the card on a hover, and not the canvas", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const { corpus } = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphCanvas />
        <Hold into={held} />
      </GraphRoot>,
    );
    if (!held.api) throw new Error("no api");
    const { store } = internalsOf(held.api);
    const renders = vi.mocked(useOverlays).mock.calls.length;
    act(() => store.hover(3));
    act(() => store.hover(4));
    act(() => store.hover(null));
    expect(vi.mocked(useOverlays).mock.calls.length).toBe(renders);
    vi.unstubAllGlobals();
  });
});
