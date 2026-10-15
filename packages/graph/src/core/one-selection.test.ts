import { MosaicClient, Query, clauseInterval, clausePoint, float64, type Coordinator, type FilterExpr, type Selection, type TableExpr } from "@kanzo-tech/mosaic";
import { crossfilterOver, onRelation, preaggregateOwnRelation, readOf, type Relation, type RelationClient, type RelationRef } from "@kanzo-tech/relations";
import { describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readJoinGraph } from "@kanzo-tech/relations";
import { createGraph } from "./store";

/**
 * **A graph and a relation dashboard on the page's one selection**, over a real DuckDB through a real
 * coordinator. The page is what `MosaicProvider joins=` builds — `crossfilterOver(joins)` — and the
 * dashboard is what `Dashboard relation=` composes, and nothing more: tiles that read the relation,
 * say so, and publish their clauses on it into the page. The graph is the unchanged store, filtering
 * by the page. Nothing bridges: the page's resolver crosses each clause into each client.
 */

/** A tile: the root keys of the relation's rows that survive the page. */
class Tile extends MosaicClient implements RelationClient {
  rows: number[] | null = null;
  readonly #table: TableExpr;
  constructor(
    filterBy: Selection,
    readonly relation: RelationRef,
    table: TableExpr,
  ) {
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

/** People and where they live: every Person lives in one Place, `i → Place i % 6`. */
const LIVES: Relation = { root: "Person", path: [{ edge: "Person_livesIn_Place", direction: "out" }] };

async function discover() {
  const corpus = await attach();
  const coordinator: Coordinator = corpus.coordinator;
  const joins = await readJoinGraph(corpus.engine, corpus.from, { signal: new AbortController().signal });
  preaggregateOwnRelation(coordinator);
  const page = crossfilterOver(joins);
  const onFailure = vi.fn();
  const graph = createGraph({ from: corpus.from, engine: corpus.engine, onFailure, filterBy: page });
  graph.subscribe(() => {});
  const { table } = readOf(joins, LIVES);
  const tiles = [new Tile(page, LIVES, table), new Tile(page, LIVES, table)] as const;
  for (const tile of tiles) coordinator.connect(tile);
  // A relation of places, beside them.
  const places = new Tile(page, "Place", readOf(joins, "Place").table);
  coordinator.connect(places);
  await settle(corpus);
  return { corpus, graph, joins, onFailure, page, places, table, tiles };
}

/** A tile's clause, on the relation it reads, from the tile itself — exempt from it, as a chart is. */
const on = (tile: Tile, clause: (source: Tile) => ReturnType<typeof clausePoint>) => onRelation(clause(tile), tile.relation);

describe("a relation dashboard beside the graph, on one selection", () => {
  it("filters the graph by what the tiles' brushes keep, as the root vertices they keep", async () => {
    const { corpus, graph, onFailure, page, tiles } = await discover();
    // score = i + 1, so a brush over 2–5 keeps People 1–4.
    page.update(on(tiles[0], (t) => clauseInterval("score", [2, 5], { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(ids(graph.getSnapshot().kept)).toEqual([1, 2, 3, 4]);
    // The tiles crossfilter each other on the relation's own columns, as published.
    expect(tiles[0].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tiles[1].rows).toEqual([1, 2, 3, 4]);

    // A second tile's pick on the far end of the join: People 3 and 9 live in Place 3. On a joined
    // relation the two clauses cross together: the people with a row where both hold.
    page.update(on(tiles[1], (t) => clausePoint("livesIn.name", "Place 3", { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(ids(graph.getSnapshot().kept)).toEqual([3]);

    // A chip's ×: Mosaic's own reset, on the one selection, and everything is back.
    page.reset([...page.clauses]);
    await settle(corpus);
    expect(page.clauses).toEqual([]);
    expect(graph.getSnapshot().kept).toBeNull();
    expect(tiles[1].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("filters the dashboard by the graph's pick, crossed into the relation by its root's key", async () => {
    const { corpus, graph, onFailure, page, tiles } = await discover();
    graph.select([3, 4], "lasso", "Lasso");
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(tiles.map((t) => t.rows)).toEqual([
      [3, 4],
      [3, 4],
    ]);
    expect(page.clauses.map((c) => c.meta)).toEqual([{ type: "semijoin", label: "Lasso", relation: "vertices" }]);
    expect(ids(graph.getSnapshot().kept)).toEqual([3, 4]);
  });

  it("keeps none of a relation with no step of the clause's type", async () => {
    const { corpus, page, places, tiles } = await discover();
    // People 1–4 live in Places 11–14; a relation of places reaches people by no step of its own.
    page.update(on(tiles[0], (t) => clauseInterval("score", [2, 5], { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(places.rows).toEqual([]);
    // A clause on places keeps the people whose place it keeps: the dashboard has a Place step.
    page.reset([...page.clauses]);
    page.update(on(places, (t) => clausePoint("name", "Place 3", { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(tiles[0].rows).toEqual([3, 9]);
  });
});
