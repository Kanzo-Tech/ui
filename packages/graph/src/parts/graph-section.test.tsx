import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanzoThemeProvider, PreferencesSections, usePref } from "@kanzo-tech/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { GraphRoot } from "../react/graph-root";
import { useGraphPrefs } from "../react/use-graph-prefs";
import { GRAPH_SECTION } from "../section";
import type { MappingModel } from "@kanzo-tech/relations";

/**
 * The graph's settings as its section, drawn by `@kanzo-tech/ui`'s generic renderer, with the root
 * as the section's owner: which columns each choice offers, which preference is drawn when, and the
 * pictures. What it cannot prove is the picture a binding draws — `store.test.ts` has the positions,
 * and `render/placement.test.ts` the orientation.
 */
const SECTIONS = [GRAPH_SECTION];

/** What a `<Pref>` beneath the root reads — the options the root answered for one column. */
function Columns({ name, into }: { name: "graph.x-by" | "graph.cluster-by" | "graph.time-by"; into: { options?: unknown } }) {
  into.options = usePref(name)?.options;
  return null;
}

function Workspace({
  corpus,
  into = {},
  column = "graph.x-by",
  mapping,
}: {
  corpus: Attached | null;
  into?: { options?: unknown };
  column?: "graph.x-by" | "graph.time-by";
  mapping?: MappingModel;
}) {
  const { look, sim, placement } = useGraphPrefs();
  return (
    <GraphRoot engine={corpus?.engine ?? null} from={corpus?.from ?? null} look={look} mapping={mapping} onFailure={() => {}} sim={sim} {...placement}>
      <PreferencesSections namespace="graph" />
      <Columns into={into} name={column} />
    </GraphRoot>
  );
}

function page(corpus: Attached | null, into?: { options?: unknown }, column?: "graph.x-by" | "graph.time-by", mapping?: MappingModel) {
  return (
    <KanzoThemeProvider sections={SECTIONS} storage={null}>
      <Workspace column={column} corpus={corpus} into={into} mapping={mapping} />
    </KanzoThemeProvider>
  );
}

const mount = (...args: Parameters<typeof page>) => render(page(...args));

/** The fixture's mapping, as rudof's `Mapping.model()` answers it, cut to `born`: a year, `xsd:gYear` over an `int32`. */
const YEARS: MappingModel = {
  tables: [
    {
      id: "#Person",
      source: { kind: "table", name: "Person" },
      subject: { kind: "column" },
      classes: [],
      annotations: [],
      columns: [
        { predicate: "https://example.org/born", value: { kind: "column", name: "born" }, termType: "Literal", datatype: "http://www.w3.org/2001/XMLSchema#gYear", annotations: [] },
      ],
      relations: [],
    },
  ],
};

beforeEach(() => {
  // Ark's Select measures its trigger; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("CSS", { escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) });
});
afterEach(() => vi.unstubAllGlobals());

const FORCES = ["Gravity", "Repulsion", "Link spring", "Link distance", "Friction"];
const sliders = () => [...document.querySelectorAll("[data-slot=slider-label]")].map((label) => label.textContent);

const picture = (name: string) => screen.getByRole("radio", { name }).closest("[data-slot=radio-group-card]")?.querySelector("svg");

describe("the graph's settings, as its section", () => {
  it("starts at Force, with its five forces, the timeline's column the only one to choose, and no cluster pull", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    expect((screen.getByRole("radio", { name: "Force" }) as HTMLInputElement).checked).toBe(true);
    expect(document.querySelectorAll("[data-slot=select-trigger]")).toHaveLength(1);
    expect(screen.queryByText("Cluster pull")).toBeNull();
    expect(sliders()).toEqual(["Labels", ...FORCES]);
  });

  it("offers the five forces under Force alone: Map has none, Clustered only its pull", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Map" }));
    expect(sliders()).toEqual(["Labels"]);
    await user.click(screen.getByRole("radio", { name: "Clustered" }));
    expect(sliders()).toEqual(["Labels", "Cluster pull"]);
    const pull = [...document.querySelectorAll("[data-slot=slider]")].find((s) => s.textContent?.includes("Cluster pull"));
    const ends = [...(pull?.querySelectorAll("[data-slot=slider-marker]") ?? [])].map((m) => m.textContent);
    expect(ends).toEqual(["Links decide", "Tight groups"]);
  });

  it("draws a picture on every card a reader picks by looking: Marks, Edges and Placement", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    for (const name of ["Dense", "Legible", "Hidden", "Straight", "Curved", "Force", "Map", "Clustered"]) {
      expect(picture(name), name).toBeTruthy();
    }
  });

  it("offers the corpus's numeric fields to the map, from the root that attached it", async () => {
    const corpus = await attach();
    const into: { options?: unknown } = {};
    mount(corpus, into);
    await act(() => settle(corpus));
    expect(into.options).toEqual(["born", "lat", "lon", "score", "team"].map((value) => ({ value, label: value })));
    await userEvent.setup().click(screen.getByRole("radio", { name: "Map" }));
    expect(document.querySelectorAll("[data-slot=select-trigger]")).toHaveLength(3);
  });

  it("offers the timeline the graph's temporal fields, by the type the engine reads", async () => {
    // `born` is an `int32` year, which GraphAr has no type for: a number, and not offered —
    // `opened` is a GraphAr `date`.
    const corpus = await attach();
    const into: { options?: unknown } = {};
    mount(corpus, into, "graph.time-by");
    await act(() => settle(corpus));
    expect(into.options).toEqual([{ value: "opened", label: "opened" }]);
  });

  it("offers the timeline a year the mapping says is one, even when the mapping arrives after the graph", async () => {
    const corpus = await attach();
    const into: { options?: unknown } = {};
    const { rerender } = mount(corpus, into, "graph.time-by");
    await act(() => settle(corpus));
    expect(into.options).toEqual([{ value: "opened", label: "opened" }]);
    const asked = corpus.sent.length;
    rerender(page(corpus, into, "graph.time-by", YEARS));
    await act(() => settle(corpus));
    expect(into.options).toEqual(["born", "opened"].map((value) => ({ value, label: value })));
    // Re-described, not read again.
    expect(corpus.sent.slice(asked).filter((sql) => sql.includes("graphar_vertex_types"))).toEqual([]);
  });

  it("pulls clusters only under Clustered, and offers Additive links only while edges are drawn", async () => {
    const corpus = await attach();
    mount(corpus);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Clustered" }));
    expect(screen.getByText("Cluster pull")).toBeTruthy();
    expect(document.querySelectorAll("[data-slot=select-trigger]")).toHaveLength(2);
    expect(screen.getByText("Additive links")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Hidden" }));
    expect(screen.queryByText("Additive links")).toBeNull();
  });

  it("answers no columns before a corpus is attached, so no column is offered", () => {
    const into: { options?: unknown } = {};
    mount(null, into);
    expect(into.options).toBeNull();
  });
});
