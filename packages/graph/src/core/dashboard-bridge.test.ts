import {
  MosaicClient,
  Query,
  Selection,
  bridgeSelection,
  clauseInterval,
  clausePoint,
  float64,
  relationQuery,
  semiJoinOf,
  type Coordinator,
  type FilterExpr,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readJoinGraph } from "./join-graph";
import { createGraph } from "./store";

/**
 * **A graph and a relation dashboard on one page selection**, over a real DuckDB through a real
 * coordinator. The dashboard is what `Dashboard` with `publish` composes, and nothing more: its tiles
 * are clients of a crossfilter of its own, bridged to the page through `semiJoinOf` on the root's key.
 * The graph is the unchanged store, filtering by the page.
 */

/** A tile: the root keys of the relation's rows that survive the dashboard's selection. */
class Tile extends MosaicClient {
  rows: number[] | null = null;
  readonly #table: TableExpr;
  constructor(filterBy: Selection, table: TableExpr) {
    super(filterBy);
    this.#table = table;
  }
  override get filterStable(): boolean {
    return false;
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

async function discover() {
  const corpus = await attach();
  const coordinator: Coordinator = corpus.coordinator;
  const page = Selection.crossfilter();
  const onFailure = vi.fn();
  const graph = createGraph({ from: corpus.from, coordinator, onFailure, filterBy: page });
  graph.subscribe(() => {});
  // People and where they live: every Person lives in one Place, `i → Place i % 6`.
  const joins = await readJoinGraph(coordinator, corpus.from);
  const table = relationQuery(joins, { root: "Person", path: [{ edge: "Person_livesIn_Place", direction: "out" }] });
  const own = Selection.crossfilter();
  const unbridge = bridgeSelection(own, page, semiJoinOf("dense_id", table, { label: "People" }));
  const tiles = [new Tile(own, table), new Tile(own, table)] as const;
  for (const tile of tiles) coordinator.connect(tile);
  await settle(corpus);
  return { corpus, graph, onFailure, own, page, table, tiles, unbridge };
}

describe("a relation dashboard beside the graph", () => {
  it("filters the graph by what the dashboard's brushes keep, as the root vertices they keep", async () => {
    const { corpus, graph, onFailure, own, page, tiles } = await discover();
    // score = i + 1, so a brush over 2–5 keeps People 1–4.
    own.update(clauseInterval("Person.score", [2, 5], { source: tiles[0], clients: new Set([tiles[0]]) }));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(ids(graph.getSnapshot().mask)).toEqual([1, 2, 3, 4]);
    expect(page.clauses.map((c) => c.meta)).toEqual([{ type: "semijoin", label: "People" }]);
    // Inside the dashboard the tiles crossfilter each other on the relation's own columns.
    expect(tiles[0].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tiles[1].rows).toEqual([1, 2, 3, 4]);

    // A second tile's pick on the far end of the join: People 3 and 9 live in Place 3.
    own.update(clausePoint("Place.name", "Place 3", { source: tiles[1], clients: new Set([tiles[1]]) }));
    await settle(corpus);
    expect(ids(graph.getSnapshot().mask)).toEqual([3]);

    // Retracting where it was published clears the dashboard too, and the graph with it.
    page.reset([...page.clauses]);
    await settle(corpus);
    expect([...own.clauses]).toEqual([]);
    expect(graph.getSnapshot().mask).toBeNull();
    expect(tiles[1].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("still filters the dashboard by the graph's pick, and publishes nothing back for it", async () => {
    const { corpus, graph, onFailure, page, tiles, unbridge } = await discover();
    graph.select([3, 4], "lasso", "Lasso");
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(tiles.map((t) => t.rows)).toEqual([
      [3, 4],
      [3, 4],
    ]);
    expect(page.clauses.map((c) => c.meta)).toEqual([{ type: "semijoin", label: "Lasso" }]);
    // The graph is exempt from its own pick, as it was before there was a dashboard.
    expect(graph.getSnapshot().mask).toBeNull();
    unbridge();
    expect(page.clauses).toHaveLength(1);
  });
});
