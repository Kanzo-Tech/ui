import { act, render, screen } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { MosaicProvider } from "@kanzo-tech/ui/analytics";
import {
  MosaicClient,
  Query,
  Selection,
  bridgeSelection,
  clauseInterval,
  float64,
  type FilterExpr,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { readStructure, relation, timelineOf } from "../core/source";
import { createGraph } from "../core/store";
import { GraphRoot } from "../react/graph-root";
import { GRAPH_SECTION } from "../section";
import { GraphTimeline } from "./graph-timeline";

function mount(corpus: Attached, timeline: string) {
  return render(
    <KanzoThemeProvider
      policy={timeline ? { graph: { "time-by": { pinned: timeline } } } : undefined}
      sections={[GRAPH_SECTION]}
      storage={null}
    >
      <MosaicProvider coordinator={corpus.coordinator}>
        <GraphRoot coordinator={corpus.coordinator} from={corpus.from} onFailure={() => {}}>
          <GraphTimeline />
        </GraphRoot>
      </MosaicProvider>
    </KanzoThemeProvider>,
  );
}

describe("GraphTimeline", () => {
  it("draws nothing until a timeline column is chosen in the graph's settings", async () => {
    const corpus = await attach();
    mount(corpus, "");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("draws the chosen column as a timeline named by it", async () => {
    const corpus = await attach();
    mount(corpus, "born");
    await act(() => settle(corpus));
    expect(screen.getByRole("figure", { name: "Timeline: born" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("draws nothing for a column this corpus does not have", async () => {
    const corpus = await attach();
    mount(corpus, "founded");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });
});

/** A client of the page over one table: the keys of its rows that survive the page's clauses. */
class Rows extends MosaicClient {
  rows: number[] | null = null;
  readonly #table: TableExpr;
  constructor(filterBy: Selection, table: TableExpr) {
    super(filterBy);
    this.#table = table;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({ id: float64("dense_id") }).from(this.#table).where(filter ?? []);
  }
  override queryResult(data: unknown): this {
    const ids = (data as { getChild(name: string): { toArray(): ArrayLike<number> } }).getChild("id").toArray();
    this.rows = Array.from(ids).sort((a, b) => a - b);
    return this;
  }
}

const ids = (mask: Uint8Array | null | undefined) => [...(mask ?? [])].flatMap((on, id) => (on ? [id] : []));

describe("timelineOf", () => {
  it("reads the key and the column from every vertex table that has it, and from no other", async () => {
    const corpus = await attach();
    const structure = await readStructure(corpus.coordinator, corpus.from);
    const table = timelineOf(structure, "born")?.table;
    expect(String(table)).toContain(`"${corpus.from}"."Person"`);
    expect(String(table)).toContain(`"dense_id"`);
    expect(String(table)).not.toContain(`"Place"`);
    expect(timelineOf(structure, "")).toBeNull();
    expect(timelineOf(structure, "dense_id")).toBeNull();
  });

  it("crosses the window into the page as a clause every client answers, leaving the types without the column whole", async () => {
    const corpus = await attach();
    const { coordinator, from } = corpus;
    const page = Selection.crossfilter();
    const onFailure = vi.fn();
    const graph = createGraph({ from, coordinator, onFailure, filterBy: page });
    graph.subscribe(() => {});
    const timeline = timelineOf(await readStructure(coordinator, from), "born");
    const own = Selection.crossfilter();
    bridgeSelection(own, page, timeline!.publish);
    // A dashboard's relation over a table with no `born`: the page's clause must not name it.
    const places = new Rows(page, relation(from, "Place"));
    coordinator.connect(places);

    // born = 1900 + i, so the window 1902–1905 keeps People 2–5.
    own.update(clauseInterval("born", [1902, 1905], { source: { reset() {} } }));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(places.rows).toEqual([10, 11, 12, 13, 14, 15]);
    const lit = ids(graph.getSnapshot().mask);
    expect(lit.filter((id) => id < 10)).toEqual([2, 3, 4, 5]);
    expect(lit.filter((id) => id >= 10 && id < 16)).toEqual([10, 11, 12, 13, 14, 15]);
  });
});
