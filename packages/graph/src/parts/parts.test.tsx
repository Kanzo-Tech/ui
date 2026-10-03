import { clauseInterval, Selection } from "@kanzo-tech/mosaic";
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
import { GraphSelect } from "./graph-select";
import { GraphStatus } from "./graph-status";
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
  const counts = () => document.querySelector('[data-slot="graph-counts"]');

  it("says what it does not know yet as a dash, and is busy while it loads", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphCounts />
      </GraphRoot>,
    );
    expect(counts()?.textContent).toBe("— nodes · — edges");
    expect(counts()?.getAttribute("aria-busy")).toBe("true");
  });

  it("counts the corpus with no filter, and the edges whose two ends are drawn", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}} x="lon" y="lat">
        <GraphCounts />
      </GraphRoot>,
    );
    await ready(corpus);
    // Bound to lon/lat, Tag has no position: the one link to it is not drawn, but its vertices are the corpus's.
    expect(counts()?.textContent).toBe("20 nodes · 19 edges");
  });

  it("says how many of the corpus match the page's filter", async () => {
    const corpus = await attach();
    const crossfilter = Selection.crossfilter();
    render(
      <GraphRoot {...over(corpus)} filterBy={crossfilter} onFailure={() => {}}>
        <GraphCounts />
      </GraphRoot>,
    );
    await ready(corpus);
    await act(async () => {
      crossfilter.update(clauseInterval("score", [2, 5], { source: { reset() {} } }));
      await settle(corpus);
    });
    // Person 1–4 by score, and every Place and Tag, which have no `score` for the clause to reach.
    expect(counts()?.textContent).toBe("14 of 20 nodes match · 7 edges");
  });
});

describe("GraphStatus", () => {
  async function status() {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    const onFailure = vi.fn();
    render(
      <GraphRoot {...over(corpus)} onFailure={onFailure}>
        <GraphStatus />
        <Hold into={held} />
      </GraphRoot>,
    );
    const badge = () => document.querySelector('[data-slot="graph-status"]');
    return { corpus, held, badge };
  }
  const word = () => document.querySelector('[data-slot="graph-status"] [aria-live="polite"]');

  it("says Loading, busy, until the graph is read and drawn", async () => {
    const { badge } = await status();
    expect(badge()?.textContent).toBe("Loading");
    expect(badge()?.getAttribute("aria-busy")).toBe("true");
  });

  it("says Laying out with how far over a drawn graph, the percentage outside the live word, then Ready", async () => {
    const { corpus, held, badge } = await status();
    await ready(corpus);
    if (!held.api) throw new Error("no api");
    const { store } = internalsOf(held.api);
    act(() => store.reportDrawn(store.getSnapshot()));
    expect(badge()?.textContent).toBe("Ready");
    expect(badge()?.getAttribute("aria-busy")).toBeNull();
    act(() => store.report("running"));
    act(() => store.reportProgress(0.42));
    expect(badge()?.textContent).toBe("Laying out42%");
    expect(word()?.textContent).toBe("Laying out");
    expect(badge()?.getAttribute("aria-busy")).toBe("true");
    act(() => store.report("settled"));
    expect(badge()?.textContent).toBe("Ready");
  });

  it("says Failed when the canvas cannot draw", async () => {
    const { corpus, held, badge } = await status();
    await ready(corpus);
    if (!held.api) throw new Error("no api");
    act(() => internalsOf(held.api as GraphApi).store.unrenderable(new Error("no device")));
    expect(word()?.textContent).toBe("Failed");
    expect(badge()?.getAttribute("aria-busy")).toBeNull();
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
    act(() => held.api?.select([1, 2], "external", "Two"));
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

describe("GraphSelect", () => {
  async function offering(load: () => Promise<readonly number[]>) {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    const onFailure = vi.fn();
    render(
      <GraphRoot {...over(corpus)} onFailure={onFailure}>
        <GraphSelect label="Two late" load={load}>
          Two late
        </GraphSelect>
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    return { held, onFailure, button: screen.getByRole("button", { name: "Two late" }) };
  }

  it("selects what load answers as an external selection named by its label, and clears it pressed again", async () => {
    const { held, button } = await offering(async () => [1, 2]);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await act(async () => fireEvent.click(button));
    expect(held.api?.getState().selection).toEqual({ vertices: [1, 2], source: "external", label: "Two late" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await act(async () => fireEvent.click(button));
    expect(held.api?.getState().selection).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("derives pressed from the live selection, so a gesture or another label unpresses it", async () => {
    const { held, button } = await offering(async () => [1, 2]);
    act(() => held.api?.select([1, 2], "external", "Two late"));
    expect(button.getAttribute("aria-pressed")).toBe("true");
    act(() => held.api?.select([1, 2], "lasso", "Two late"));
    expect(button.getAttribute("aria-pressed")).toBe("false");
    act(() => held.api?.select([1, 2], "external", "Another"));
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("hands a rejected load to the root's onFailure as thrown, selects nothing, and can be pressed again", async () => {
    const failure = new Error("refused");
    const { held, button, onFailure } = await offering(() => Promise.reject(failure));
    await act(async () => fireEvent.click(button));
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(held.api?.getState().selection).toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
