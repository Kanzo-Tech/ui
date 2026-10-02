import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, refusal, settle, type Attached } from "../../test/corpus";
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

/** The root's two source props, for an attached corpus. */
const over = (corpus: Attached) => ({ from: corpus.from, coordinator: corpus.coordinator });
const ready = (corpus: Attached) => act(() => settle(corpus));
const noResize = () =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

describe("GraphLegend", () => {
  it("draws the domain before the graph has loaded, named by the root", async () => {
    const corpus = await attach();
    render(
      <GraphRoot categories={{ 0: "Amber", 3: "Salt" }} {...over(corpus)} fill="team" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["Amber—", "Salt—"]);
  });

  it("draws the vertex types when nothing is bound, with what each has drawn", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    await ready(corpus);
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["Person10", "Place6", "Tag4"]);
  });

  it("draws nothing when colour is a constant and nothing carries a category", async () => {
    const corpus = await attach();
    const { container } = render(
      <GraphRoot {...over(corpus)} fill="var(--foreground)" onFailure={() => {}}>
        <GraphLegend />
      </GraphRoot>,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("GraphCounts", () => {
  it("says what it does not know yet as a dash, and is busy while it loads", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphCounts spinner />
      </GraphRoot>,
    );
    const counts = document.querySelector('[data-slot="graph-counts"]');
    expect(counts?.textContent).toBe("— of — nodes drawn · — edges");
    expect(counts?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("counts what is drawn of the whole, and the edges whose two ends are drawn", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}} x="lon" y="lat">
        <GraphCounts />
      </GraphRoot>,
    );
    await ready(corpus);
    // Bound to lon/lat, Tag has no position: its four vertices and the one link to them are not drawn.
    expect(document.querySelector('[data-slot="graph-counts"]')?.textContent).toBe("16 of 20 nodes drawn · 19 edges");
  });

  it("spins for a running layout without calling the figures busy", async () => {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphCounts spinner />
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    if (!held.api) throw new Error("no api");
    const { store } = internalsOf(held.api);
    act(() => store.reportDrawn(store.getSnapshot()));
    act(() => store.report("running"));
    expect(screen.getByRole("status", { name: "Laying out" })).toBeTruthy();
    expect(document.querySelector('[data-slot="graph-counts"]')?.getAttribute("aria-busy")).toBeNull();
  });
});

describe("GraphToolbar", () => {
  async function toolbar() {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphToolbar />
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    return held;
  }

  it("arms a tool and disarms it, through the root's state", async () => {
    await toolbar();
    const lasso = screen.getByRole("button", { name: "Lasso" });
    fireEvent.click(lasso);
    expect(lasso.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(lasso);
    expect(lasso.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the selection, and clears it", async () => {
    const held = await toolbar();
    expect(screen.queryByRole("group", { name: "Current selection" })).toBeNull();
    act(() => held.api?.select([1, 2], "order", "Two"));
    expect(screen.getByRole("group", { name: "Current selection" }).textContent).toContain("2 of 20 selected");
    fireEvent.click(screen.getByRole("button", { name: "Clear the selection" }));
    expect(screen.queryByRole("group", { name: "Current selection" })).toBeNull();
  });

  it("offers to run the layout without a simulate prop", async () => {
    await toolbar();
    const layout = screen.getByRole("group", { name: "Layout" });
    expect(layout.querySelector('[aria-label="Run the layout"]')).toBeTruthy();
  });
});

describe("GraphInspector", () => {
  async function inspecting(children?: (detail: { fields: readonly { name: string; value: unknown }[] }) => React.ReactNode) {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    const onFailure = vi.fn();
    render(
      <GraphRoot {...over(corpus)} fill="team" onFailure={onFailure}>
        <GraphInspector>{children}</GraphInspector>
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    return { corpus, held, onFailure };
  }

  it("reads the focused vertex's row with one statement, and draws a host's extra fields after the corpus's own", async () => {
    const extra = vi.fn((detail: { fields: readonly { name: string; value: unknown }[] }) => (
      <p data-testid="extra">score plus one: {Number(detail.fields.find((f) => f.name === "score")?.value) + 1}</p>
    ));
    const { corpus, held } = await inspecting(extra);
    expect(screen.getByText("Click a vertex on the canvas to inspect it.")).toBeTruthy();
    act(() => held.api?.setFocus(6));
    await waitFor(() => expect(screen.getByTestId("extra").textContent).toBe("score plus one: 8"));
    const labels = [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(labels).toEqual(["subject", "name", "team", "score", "lon", "lat"]);
    expect(corpus.sent.at(-1)).toMatch(/"Person" WHERE dense_id = 6$/);
  });

  it("says a vertex is not in the corpus, and reports nothing", async () => {
    const { held, onFailure } = await inspecting();
    act(() => held.api?.setFocus(99));
    await waitFor(() => expect(screen.getByText("This vertex is not in the corpus.")).toBeTruthy());
    expect(screen.queryByText("This vertex could not be read.")).toBeNull();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("says a vertex could not be read, and hands onFailure the thrown value", async () => {
    const { corpus, held, onFailure } = await inspecting();
    const refused = refusal();
    corpus.refuse(/WHERE dense_id = 6/, refused);
    act(() => held.api?.setFocus(6));
    await waitFor(() => expect(screen.getByText("This vertex could not be read.")).toBeTruthy());
    expect(screen.queryByText("This vertex is not in the corpus.")).toBeNull();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(refused);
  });
});

describe("GraphSearch", () => {
  beforeEach(noResize);
  afterEach(() => vi.unstubAllGlobals());

  async function searching(onFailure = () => {}) {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot categories={{ Person: "People", Place: "Places" }} {...over(corpus)} onFailure={onFailure} title="name">
        <GraphSearch limit={3} />
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    return { corpus, held, input: screen.getByRole("combobox") as HTMLInputElement };
  }
  const options = () => screen.getAllByRole("option").map((option) => option.textContent);

  it("reads nothing until the reader types", async () => {
    const { corpus, input } = await searching();
    expect(input.disabled).toBe(false);
    expect(corpus.sent.some((sql) => sql.includes("ILIKE"))).toBe(false);
  });

  it("asks the corpus once per pause, shortest match first, named by the root, and says when it stopped", async () => {
    const { corpus, input } = await searching();
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "per" } });
    fireEvent.change(input, { target: { value: "person" } });
    await waitFor(() => expect(options()).toEqual(["Person 0People", "Person 1People", "Person 2People"]));
    expect(corpus.sent.filter((sql) => sql.includes("ILIKE"))).toHaveLength(1);
    expect(screen.getByText("First 3. Keep typing to narrow it.")).toBeTruthy();
  });

  it("matches without case, falls back to a table's identity, and picking reveals the vertex", async () => {
    const { held, input } = await searching();
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "place 3" } });
    await waitFor(() => expect(options()).toEqual(["Place 3Places"]));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(held.api?.getState().focus).toBe(13));
    fireEvent.change(input, { target: { value: "tag/2" } });
    await waitFor(() => expect(options()).toEqual(["https://example.org/tag/2Tag"]));
  });

  it("hands onFailure the thrown value, and says the names could not be read", async () => {
    const onFailure = vi.fn();
    const { corpus, input } = await searching(onFailure);
    const refused = refusal();
    corpus.refuse(/ILIKE/, refused);
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "person" } });
    await waitFor(() => expect(screen.getByPlaceholderText("The names could not be read.")).toBeTruthy());
    expect(onFailure).toHaveBeenCalledWith(refused);
  });
});

describe("GraphCanvas", () => {
  beforeEach(noResize);
  afterEach(() => vi.unstubAllGlobals());

  it("hands onFailure the thrown value when a label's read rejects", async () => {
    const corpus = await attach();
    const refused = refusal();
    corpus.refuse(/dense_id IN/, refused);
    const onFailure = vi.fn();
    render(
      <GraphRoot {...over(corpus)} onFailure={onFailure}>
        <GraphCanvas />
      </GraphRoot>,
    );
    await ready(corpus);
    await waitFor(() => expect(onFailure.mock.calls.map(([error]) => error)).toContain(refused));
  });

  it("re-renders the card on a hover, and not the canvas", async () => {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
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
  });
});
