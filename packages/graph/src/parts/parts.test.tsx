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
import type { LabelLevel } from "../render/graph-looks";

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
    expect(labels("Values")).toEqual(["name", "team", "score", "lon", "lat"]);
    expect(screen.queryByRole("region", { name: "Dates" })).toBeNull();
    expect(corpus.sent.filter((sql) => /"Person" WHERE \("dense_id" = 6\)$/.test(sql))).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Identity" })).toBeNull();
    expect(document.querySelector('[data-slot="graph-inspector-iri"] a')?.getAttribute("href")).toBe("https://example.org/person/6");
    expect(document.querySelector('[data-slot="graph-inspector-title"]')?.textContent).toBe("Person 6");
  });

  it("heads with the IRI's local name when there is no title, prints the IRI under it with Copy, and lists no neighbours", async () => {
    const corpus = await attach();
    const held: { api: GraphApi | null } = { api: null };
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphInspector />
        <Hold into={held} />
      </GraphRoot>,
    );
    await ready(corpus);
    act(() => held.api?.setFocus(6));
    await waitFor(() => expect(document.querySelector('[data-slot="graph-inspector-title"]')?.textContent).toBe("6"));
    const iri = document.querySelector('[data-slot="graph-inspector-iri"]');
    expect(iri?.textContent).toBe("https://example.org/person/6");
    expect(iri?.querySelector('[aria-label="Copy the IRI"]')).toBeTruthy();
    expect(section("Values")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Neighbours" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Copy its fields/ })).toBeNull();
  });

  it("locates the vertex, and offers nothing a click on the canvas already does", async () => {
    const { held } = await inspecting();
    act(() => held.api?.setFocus(6));
    fireEvent.click(await screen.findByRole("button", { name: "Locate" }));
    expect(held.api?.getState().selection).toEqual({ vertices: [6], source: "node", label: "Node" });
    expect(screen.queryByRole("button", { name: /neighbours/i })).toBeNull();
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
    const cue = screen.getByRole("button", { name: /Find a node/ });
    await act(async () => fireEvent.click(cue));
    const input = (await screen.findByRole("combobox")) as HTMLInputElement;
    await act(async () => input.focus());
    return { corpus, held, cue, input };
  }
  // An option's name, without what tells it apart — that is `details`.
  const options = () => screen.queryAllByRole("option").map((option) => option.querySelector("span")?.textContent);
  const details = () => screen.queryAllByRole("option").map((option) => option.querySelector("span:last-child")?.textContent);
  const groups = () => [...document.querySelectorAll('[data-slot="command-group"]')].map((group) => group.firstElementChild?.textContent);
  const chips = () => [...document.querySelectorAll('[data-slot="tags-input-item-text"]')].map((chip) => chip.textContent);
  const type = (input: HTMLInputElement, value: string) => act(async () => fireEvent.input(input, { target: { value } }));

  it("is a cue in the page that holds nothing, and reads nothing until the reader types", async () => {
    const { corpus, cue } = await searching();
    expect(cue.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(corpus.sent.some((sql) => sql.includes("ILIKE"))).toBe(false);
  });

  it("opens and closes the palette on ⌘K or Ctrl+K", async () => {
    const corpus = await attach();
    render(
      <GraphRoot {...over(corpus)} onFailure={() => {}}>
        <GraphSearch />
      </GraphRoot>,
    );
    await ready(corpus);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => fireEvent.keyDown(window, { key: "k", metaKey: true }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await act(async () => fireEvent.keyDown(window, { key: "K", ctrlKey: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("asks the corpus once per pause, shortest match first, grouped by type with every match counted, and says when it stopped", async () => {
    const { corpus, input } = await searching();
    await type(input, "per");
    await type(input, "person");
    await waitFor(() => expect(options()).toEqual(["Person 0", "Person 1", "Person 2"]));
    expect(groups()).toEqual(["People10"]);
    expect(corpus.sent.filter((sql) => sql.includes("ILIKE"))).toHaveLength(1);
    expect(details()).toEqual(["0", "1", "2"]);
    expect(screen.getByText("First 3 of 10 — keep typing to narrow it")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Select all/ })).toBeTruthy();
  });

  it("offers, empty, every vertex type with its count, and picking one makes it a chip", async () => {
    const { input } = await searching();
    expect(groups()).toEqual(["Narrow to a type"]);
    expect(options()).toEqual(["People", "Places", "Tag"]);
    expect(details()).toEqual(["10", "6", "4"]);
    expect(screen.getByText(/Narrow with/)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("option", { name: /Places/ })));
    expect(chips()).toEqual(["type:Place"]);
    await waitFor(() => expect(groups()).toEqual(["Places6"]));
    expect(input.value).toBe("");
  });

  it("matches without case, falls back to a table's identity, and Enter reveals the vertex, closes, and remembers it", async () => {
    const { held, cue, input } = await searching();
    await type(input, "place 3");
    await waitFor(() => expect(options()).toEqual(["Place 3"]));
    expect(document.querySelector("mark")?.textContent).toBe("Place 3");
    await act(async () => fireEvent.keyDown(input, { key: "ArrowDown" }));
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    await waitFor(() => expect(held.api?.getState().focus).toBe(13));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => fireEvent.click(cue));
    await waitFor(() => expect(groups()).toEqual(["Recent", "Narrow to a type"]));
    expect(options()[0]).toBe("Place 3");
    expect(details()[0]).toBe("Places");
    const again = screen.getByRole("combobox") as HTMLInputElement;
    await act(async () => again.focus());
    await type(again, "tag/2");
    await waitFor(() => expect(options()).toEqual(["https://example.org/tag/2"]));
  });

  it("keeps a type with type:, a column with <column>:<value>, and an IRI typed whole as text", async () => {
    const { input } = await searching();
    await type(input, "type:Place");
    await waitFor(() => expect(groups()).toEqual(["Places6"]));
    await type(input, "team:2");
    await waitFor(() => expect(options()).toEqual(["Person 2", "Person 6"]));
    await type(input, "type:tag lat:1");
    await waitFor(() => expect(screen.getByText("Nothing by that name.")).toBeTruthy());
    await type(input, "https://example.org/tag/3");
    await waitFor(() => expect(options()).toEqual(["https://example.org/tag/3"]));
    await type(input, "subject:place/4");
    await waitFor(() => expect(options()).toEqual(["Place 4"]));
  });

  it("turns a type: or column: word into a chip on Space, keeps free text as text, and takes the last chip back on Backspace", async () => {
    const { input } = await searching();
    await type(input, "type:Person");
    await type(input, "type:Person ");
    expect(chips()).toEqual(["type:Person"]);
    expect(input.value).toBe("");
    await type(input, "2");
    await waitFor(() => expect(options()).toEqual(["Person 2"]));
    await type(input, "2 ");
    expect(chips()).toEqual(["type:Person"]);
    await type(input, "");
    await act(async () => fireEvent.keyDown(input, { key: "Backspace" }));
    await act(async () => fireEvent.keyDown(input, { key: "Backspace" }));
    expect(chips()).toEqual([]);
  });

  it("selects every match, past the limit, as one external selection, from its button or ⌘Enter", async () => {
    const { held, input } = await searching();
    await type(input, "type:Person");
    fireEvent.click(await screen.findByRole("button", { name: /Select all/ }));
    await waitFor(() => expect(held.api?.getState().selection?.vertices).toHaveLength(10));
    expect(held.api?.getState().selection?.label).toBe("Matches for “type:Person”");
    await act(async () => held.api?.select([], "external"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Find a node/ })));
    const again = screen.getByRole("combobox") as HTMLInputElement;
    await act(async () => again.focus());
    await type(again, "type:Place");
    await screen.findByText("First 3 of 6 — keep typing to narrow it");
    await act(async () => fireEvent.keyDown(again, { key: "Enter", metaKey: true }));
    await waitFor(() => expect(held.api?.getState().selection?.vertices).toHaveLength(6));
    expect(held.api?.getState().focus).not.toBe(10);
  });

  it("hands onFailure the thrown value, and says the names could not be read", async () => {
    const onFailure = vi.fn();
    const { corpus, input } = await searching(onFailure);
    const refused = refusal();
    corpus.refuse(/ILIKE/, refused);
    await type(input, "person");
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

  describe("labels", () => {
    const labels = () => [...document.querySelectorAll("[data-slot=graph-canvas-label]")].map((el) => el.textContent);
    const mount = async (labelled: LabelLevel) => {
      const corpus = await attach();
      const held: { api: GraphApi | null } = { api: null };
      render(
        <GraphRoot {...over(corpus)} look={{ labels: labelled }} onFailure={() => {}} title="name">
          <GraphCanvas />
          <Hold into={held} />
        </GraphRoot>,
      );
      await ready(corpus);
      if (!held.api) throw new Error("no api");
      return { corpus, store: internalsOf(held.api).store };
    };

    it("names nothing at None, not even the hovered point", async () => {
      const { corpus, store } = await mount("none");
      act(() => store.focus(1));
      act(() => store.hover(1));
      await act(() => settle(corpus));
      expect(labels()).toEqual([]);
      expect(document.querySelector("[data-slot=graph-canvas-card]")).toBeNull();
    });

    it("names the focused point and nothing standing at Hovered", async () => {
      const { corpus, store } = await mount("hovered");
      expect(labels()).toEqual([]);
      act(() => store.focus(2));
      await waitFor(() => expect(labels()).toEqual(["Person 2"]));
      await act(() => settle(corpus));
    });

    it("names the biggest points first at Top, within its budget", async () => {
      await mount("top");
      // Degree is the size, so the three Tags no relation reaches come last.
      await waitFor(() => expect(labels()).toHaveLength(20));
      expect(labels().slice(-3).every((text) => text?.startsWith("https://example.org/tag/"))).toBe(true);
    });
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
