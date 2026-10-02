import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { GraphRoot, useGraphContext } from "../react/graph-root";
import { internalsOf, type GraphApi } from "../react/use-graph";
import { GraphCanvas } from "./graph-canvas";
import { GraphCounts } from "./graph-counts";
import { GraphInspector } from "./graph-inspector";
import { GraphLegend } from "./graph-legend";
import { GraphSearch } from "./graph-search";
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
  });

  it("draws nothing when colour is a constant and nothing carries a category", () => {
    const { corpus } = fakeCorpus();
    const { container } = render(
      <GraphRoot corpus={corpus} fill="var(--foreground)" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("GraphCounts", () => {
  it("says what it does not know yet as a dash, and is busy while it loads", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphCounts spinner />
      </GraphRoot>,
    );
    const counts = document.querySelector('[data-slot="graph-counts"]');
    expect(counts?.textContent).toBe("— of 16 nodes drawn · — edges");
    expect(counts?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("counts what is drawn of the whole, and the edges whose two ends are drawn", async () => {
    const fake = fakeCorpus();
    render(
      <GraphRoot corpus={fake.corpus} onFailure={() => {}}>
        <GraphCounts />
      </GraphRoot>,
    );
    await act(() => fake.settle());
    expect(document.querySelector('[data-slot="graph-counts"]')?.textContent).toBe("16 of 16 nodes drawn · 19 edges");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("spins for a running layout without calling the figures busy", async () => {
    const fake = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot corpus={fake.corpus} onFailure={() => {}}>
        <GraphCounts spinner />
        <Hold into={held} />
      </GraphRoot>,
    );
    await act(() => fake.settle());
    if (!held.api) throw new Error("no api");
    const { store } = internalsOf(held.api);
    act(() => store.reportDrawn(store.getSnapshot()));
    act(() => store.report("running"));
    expect(screen.getByRole("status", { name: "Laying out" })).toBeTruthy();
    expect(document.querySelector('[data-slot="graph-counts"]')?.getAttribute("aria-busy")).toBeNull();
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

describe("GraphSearch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  async function searching() {
    const fake = fakeCorpus();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot categories={{ Person: "People", Place: "Places" }} corpus={fake.corpus} onFailure={() => {}} r="degree" title="name">
        <GraphSearch limit={3} />
        <Hold into={held} />
      </GraphRoot>,
    );
    await act(() => fake.settle());
    await act(() => fake.settle());
    const input = screen.getByRole("combobox");
    return { fake, held, input };
  }
  const options = () => screen.getAllByRole("option").map((option) => option.textContent);

  it("reads every drawn vertex's text once, by its title or its table's identity", async () => {
    const { fake } = await searching();
    const reads = fake.scans.filter((scan) => scan.select?.length === 2 && scan.select[0] === "dense_id");
    expect(reads.map((scan) => [scan.table, scan.select])).toEqual([
      ["Person", ["dense_id", "subject"]],
      ["Place", ["dense_id", "name"]],
    ]);
  });

  it("offers the biggest on the ramp first, named by the root, and says when it stopped", async () => {
    const { input } = await searching();
    expect((input as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(input);
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(options()).toEqual([
      "https://example.org/person/9People",
      "https://example.org/person/8People",
      "https://example.org/person/7People",
    ]);
    expect(screen.getByText("First 3. Keep typing to narrow it.")).toBeTruthy();
  });

  it("filters in the browser as the reader types, and picking reveals the vertex", async () => {
    const { fake, held, input } = await searching();
    const before = fake.scans.length;
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "place 3" } });
    await waitFor(() => expect(options()).toEqual(["Place 3Places"]));
    expect(fake.scans.length).toBe(before);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(held.api?.getState().focus).toBe(13));
  });
});

describe("GraphCanvas", () => {
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
