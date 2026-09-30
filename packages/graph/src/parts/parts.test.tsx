import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { vertexId } from "../core/resident";
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
  it("draws the manifest's domain before a tile has arrived, named by the root", () => {
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot categories={{ 0: "Amber", 3: "Salt" }} corpus={corpus} fill="cluster_id" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["Amber—", "1—", "2—", "Salt—"]);
    expect(screen.getByText("— of 16 drawn")).toBeTruthy();
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
    act(() => held.api?.select([vertexId(0, 1), vertexId(0, 2)], "order", "Two"));
    expect(screen.getByRole("group", { name: "Current selection" }).textContent).toContain("2 of 16 selected");
    fireEvent.click(screen.getByRole("button", { name: "Clear the selection" }));
    expect(screen.queryByRole("group", { name: "Current selection" })).toBeNull();
  });

  it("offers the layout's transport only when the layout is live", () => {
    const { corpus } = fakeCorpus();
    const { rerender } = render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <GraphToolbar />
      </GraphRoot>,
    );
    expect(screen.queryByRole("group", { name: "Layout" })).toBeNull();
    rerender(
      <GraphRoot corpus={corpus} onFailure={() => {}} simulate>
        <GraphToolbar />
      </GraphRoot>,
    );
    expect(screen.getByRole("group", { name: "Layout" })).toBeTruthy();
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
    act(() => held.api?.setFocus(vertexId(0, 6)));
    await act(() => fake.settle());
    await waitFor(() => expect(screen.getByTestId("extra").textContent).toBe("degree plus one: 8"));
    const labels = [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(labels).toEqual(["subject", "cluster_id", "degree"]);
    expect(fake.scans.at(-1)?.filter).toEqual({ column: "dense_id", op: "=", value: 6 });
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
    act(() => store.hover(vertexId(0, 3)));
    act(() => store.hover(vertexId(0, 4)));
    act(() => store.hover(null));
    expect(vi.mocked(useOverlays).mock.calls.length).toBe(renders);
    vi.unstubAllGlobals();
  });
});
