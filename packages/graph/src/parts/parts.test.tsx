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
      <GraphRoot {...over(corpus)} fill="team" onFailure={onFailure} title="name">
        <GraphInspector>{children}</GraphInspector>
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    return { corpus, held, onFailure };
  }
  const section = (name: string) => screen.getByRole("region", { name });

  it("reads the focused vertex's row with one statement, grouped, and draws a host's extra fields after its values", async () => {
    const extra = vi.fn((detail: { fields: readonly { name: string; value: unknown }[] }) => (
      <p data-testid="extra">score plus one: {Number(detail.fields.find((f) => f.name === "score")?.value) + 1}</p>
    ));
    const { corpus, held } = await inspecting(extra);
    expect(screen.getByText("Click a vertex on the canvas to inspect it.")).toBeTruthy();
    act(() => held.api?.setFocus(6));
    await waitFor(() => expect(screen.getByTestId("extra").textContent).toBe("score plus one: 8"));
    const labels = (name: string) => [...section(name).querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(labels("Identity")).toEqual(["subject"]);
    expect(labels("Values")).toEqual(["name", "team", "score", "lon", "lat"]);
    expect(screen.queryByRole("region", { name: "Dates" })).toBeNull();
    expect(corpus.sent.filter((sql) => /"Person" WHERE \("dense_id" = 6\)$/.test(sql))).toHaveLength(1);
    expect(section("Identity").querySelector("a")?.getAttribute("href")).toBe("https://example.org/person/6");
    expect(document.querySelector('[data-slot="graph-inspector-title"]')?.textContent).toBe("Person 6");
  });

  it("counts the neighbours per relation and direction, and pressing one selects that set", async () => {
    const { held } = await inspecting();
    act(() => held.api?.setFocus(6));
    const region = await waitFor(() => {
      const found = section("Neighbours");
      expect(found.querySelectorAll("button")).toHaveLength(3);
      return found;
    });
    expect([...region.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["knows → Person1", "knows ← Person1", "livesIn → Place1"]);
    fireEvent.click(screen.getByText("livesIn → Place"));
    await waitFor(() => expect(held.api?.getState().selection).toEqual({ vertices: [10], source: "external", label: "livesIn → Place of Person 6" }));
  });

  it("focuses on the vertex and every neighbour as one external selection, and zooms to it", async () => {
    const { held } = await inspecting();
    act(() => held.api?.setFocus(6));
    fireEvent.click(await screen.findByRole("button", { name: "Focus on its neighbours" }));
    await waitFor(() => expect(held.api?.getState().selection?.label).toBe("Neighbours of Person 6"));
    expect([...(held.api?.getState().selection?.vertices ?? [])].sort((a, b) => a - b)).toEqual([5, 6, 7, 10]);
    fireEvent.click(screen.getByRole("button", { name: "Zoom to it" }));
    expect(held.api?.getState().selection).toEqual({ vertices: [6], source: "node", label: "Node" });
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
    corpus.refuse(/WHERE \("dense_id" = 6\)$/, refused);
    act(() => held.api?.setFocus(6));
    await waitFor(() => expect(screen.getByText("This vertex could not be read.")).toBeTruthy());
    expect(screen.queryByText("This vertex is not in the corpus.")).toBeNull();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(refused);
  });
});

describe("GraphSearch", () => {
  beforeEach(() => {
    noResize();
    // zag finds an option by `CSS.escape`, which jsdom does not ship.
    vi.stubGlobal("CSS", { escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) });
  });
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
  const options = () => screen.queryAllByRole("option").map((option) => option.textContent);
  const groups = () => [...document.querySelectorAll('[data-slot="command-group"]')].map((group) => group.firstElementChild?.textContent);
  const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });

  it("reads nothing until the reader types", async () => {
    const { corpus, input } = await searching();
    expect(input.disabled).toBe(false);
    expect(input.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
    expect(corpus.sent.some((sql) => sql.includes("ILIKE"))).toBe(false);
  });

  it("asks the corpus once per pause, shortest match first, grouped by type with every match counted, and says when it stopped", async () => {
    const { corpus, input } = await searching();
    type(input, "per");
    type(input, "person");
    await waitFor(() => expect(options()).toEqual(["Person 0", "Person 1", "Person 2"]));
    expect(groups()).toEqual(["People10"]);
    expect(corpus.sent.filter((sql) => sql.includes("ILIKE"))).toHaveLength(1);
    expect(screen.getByText("First 3. Keep typing to narrow it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select 10 matches" })).toBeTruthy();
  });

  it("matches without case, falls back to a table's identity, and picking reveals the vertex and remembers it", async () => {
    const { held, input } = await searching();
    type(input, "place 3");
    await waitFor(() => expect(options()).toEqual(["Place 3"]));
    expect(document.querySelector("mark")?.textContent).toBe("Place 3");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(held.api?.getState().focus).toBe(13));
    await waitFor(() => expect(groups()).toEqual(["Recent"]));
    expect(options()).toEqual(["Place 3Places"]);
    type(input, "tag/2");
    await waitFor(() => expect(options()).toEqual(["https://example.org/tag/2"]));
  });

  it("keeps a type with type:, a column with <column>:<value>, and an IRI typed whole as text", async () => {
    const { input } = await searching();
    type(input, "type:Place");
    await waitFor(() => expect(groups()).toEqual(["Places6"]));
    type(input, "team:2");
    await waitFor(() => expect(options()).toEqual(["Person 2", "Person 6"]));
    type(input, "type:tag lat:1");
    await waitFor(() => expect(screen.getByText("Nothing by that name.")).toBeTruthy());
    type(input, "https://example.org/tag/3");
    await waitFor(() => expect(options()).toEqual(["https://example.org/tag/3"]));
    type(input, "subject:place/4");
    await waitFor(() => expect(options()).toEqual(["Place 4"]));
  });

  it("selects every match, past the limit, as one external selection", async () => {
    const { held, input } = await searching();
    type(input, "type:Person");
    fireEvent.click(await screen.findByRole("button", { name: "Select 10 matches" }));
    await waitFor(() => expect(held.api?.getState().selection?.vertices).toHaveLength(10));
    expect(held.api?.getState().selection?.label).toBe("Matches for “type:Person”");
  });

  it("hands onFailure the thrown value, and says the names could not be read", async () => {
    const onFailure = vi.fn();
    const { corpus, input } = await searching(onFailure);
    const refused = refusal();
    corpus.refuse(/ILIKE/, refused);
    type(input, "person");
    await waitFor(() => expect(screen.getByPlaceholderText("The names could not be read.")).toBeTruthy());
    expect(onFailure).toHaveBeenCalledWith(refused);
  });

  it("moves ⌘K to the search of the graph the reader last used, so two graphs do not fight", async () => {
    const [one, two] = [await attach(), await attach()];
    const held = [{ api: null }, { api: null }] as { api: GraphApi | null }[];
    render(
      <>
        {[one, two].map((corpus, i) => (
          <GraphRoot key={corpus.from} {...over(corpus)} onFailure={() => {}}>
            <GraphSearch placeholder={`graph ${i}`} />
            <Hold into={held[i] as { api: GraphApi | null }} />
          </GraphRoot>
        ))}
      </>,
    );
    await act(() => Promise.all([settle(one), settle(two)]));
    const [first, second] = [screen.getByPlaceholderText("graph 0"), screen.getByPlaceholderText("graph 1")];
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(second);
    act(() => held[0]?.api?.setFocus(3));
    fireEvent.keyDown(document, { key: "K", ctrlKey: true });
    expect(document.activeElement).toBe(first);
  });
});

describe("GraphCanvas", () => {
  beforeEach(noResize);
  afterEach(() => vi.unstubAllGlobals());

  it("hands onFailure the thrown value when a label's read rejects", async () => {
    const corpus = await attach();
    const refused = refusal();
    corpus.refuse(/"dense_id" IN/, refused);
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
