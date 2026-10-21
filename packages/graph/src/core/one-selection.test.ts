import {
  MosaicClient,
  Query,
  clauseInterval,
  clausePoint,
  crossfilterOver,
  float64,
  onRelation,
  preaggregateOwnRelation,
  relationOver,
  type Coordinator,
  type FilterExpr,
  type Relation,
  type RelationClient,
  type Selection,
} from "@kanzo-tech/mosaic";
import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { createGraph } from "./store";

/**
 * **A graph and a relation dashboard on the page's one selection**, over a real DuckDB through a real
 * coordinator. The page is what `MosaicProvider graph=` builds — `crossfilterOver(graph)` — and the
 * dashboard is what `Dashboard relation=` composes over a pattern, and nothing more: tiles that read the relation,
 * say so, and publish their clauses on it into the page. The graph is the unchanged store, filtering
 * by the page. Nothing bridges: the page's resolver crosses each clause into each client.
 */

/** A tile: the indexes of the relation's first vertex on the rows that survive the page. */
class Tile extends MosaicClient implements RelationClient {
  rows: number[] | null = null;
  constructor(
    filterBy: Selection,
    readonly relation: Relation,
  ) {
    super(filterBy);
  }
  override get filterStable(): boolean {
    return false;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({ id: float64(this.relation.roots[0]!.variable!) }).from(this.relation.table).where(filter ?? []);
  }
  override queryResult(data: unknown): this {
    const ids = (data as { getChild(name: string): { toArray(): ArrayLike<number> } }).getChild("id").toArray();
    this.rows = Array.from(ids).sort((a, b) => a - b);
    return this;
  }
}

const ids = (mask: Uint8Array | null | undefined) => [...(mask ?? [])].flatMap((on, id) => (on ? [id] : []));

/** People and where they live: every Person lives in one Place, `i → Place i % 6`. */
const LIVES: Pattern = [{ as: "person", type: "Person" }, { edge: "livesIn", direction: "out" }, { as: "place", type: "Place" }];

async function discover() {
  const corpus = await attach();
  const coordinator: Coordinator = corpus.coordinator;
  preaggregateOwnRelation(coordinator);
  const page = crossfilterOver(corpus.graph);
  const onFailure = vi.fn();
  const graph = createGraph({ graph: corpus.graph, engine: corpus.engine, onFailure, filterBy: page });
  graph.subscribe(() => {});
  const lives = relationOver(corpus.graph, LIVES);
  const tiles = [new Tile(page, lives), new Tile(page, lives)] as const;
  for (const tile of tiles) coordinator.connect(tile);
  // A relation of places, beside them: its rows are Place indexes, 0–5.
  const places = new Tile(page, relationOver(corpus.graph, [{ as: "place", type: "Place" }]));
  coordinator.connect(places);
  await settle(corpus);
  return { corpus, graph, onFailure, page, places, tiles };
}

/** A tile's clause, on the relation it reads, from the tile itself — exempt from it, as a chart is. */
const on = (tile: Tile, clause: (source: Tile) => ReturnType<typeof clausePoint>) => onRelation(clause(tile), tile.relation);

describe("a relation dashboard beside the graph, on one selection", () => {
  it("filters the graph by what the tiles' brushes keep, as the root vertices they keep", async () => {
    const { corpus, graph, onFailure, page, tiles } = await discover();
    // score = i + 1, so a brush over 2–5 keeps People 1–4.
    page.update(on(tiles[0], (t) => clauseInterval("person.score", [2, 5], { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(ids(graph.getSnapshot().kept)).toEqual([1, 2, 3, 4]);
    // The tiles crossfilter each other on the relation's own columns, as published.
    expect(tiles[0].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tiles[1].rows).toEqual([1, 2, 3, 4]);

    // A second tile's pick on the pattern's far end: People 3 and 9 live in Place 3. On one pattern
    // the two clauses cross together: the people with a row where both hold.
    page.update(on(tiles[1], (t) => clausePoint("place.name", "Place 3", { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(ids(graph.getSnapshot().kept)).toEqual([3]);

    // A chip's ×: Mosaic's own reset, on the one selection, and everything is back.
    page.reset([...page.clauses]);
    await settle(corpus);
    expect(page.clauses).toEqual([]);
    expect(graph.getSnapshot().kept).toBeNull();
    expect(tiles[1].rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("filters the dashboard by the graph's pick, landed on the pattern's vertex of the same type", async () => {
    const { corpus, graph, onFailure, page, tiles } = await discover();
    graph.select([3, 4], "lasso", "Lasso");
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(tiles.map((t) => t.rows)).toEqual([
      [3, 4],
      [3, 4],
    ]);
    expect(page.clauses.map((c) => c.meta)).toMatchObject([{ type: "semijoin", label: "Lasso", relation: { key: "vertices" } }]);
    expect(ids(graph.getSnapshot().kept)).toEqual([3, 4]);
  });

  it("carries a clause along the graph's one path to a relation with no vertex of its type", async () => {
    const { corpus, page, places, tiles } = await discover();
    // People 1–4 live in Places 1–4: a relation of places holds no person, and Person to Place is one hop.
    page.update(on(tiles[0], (t) => clauseInterval("person.score", [2, 5], { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(places.rows).toEqual([1, 2, 3, 4]);
    // A clause on places keeps the people whose place it keeps: the dashboard's pattern holds a Place.
    page.reset([...page.clauses]);
    page.update(on(places, (t) => clausePoint("place.name", "Place 3", { source: t, clients: new Set([t]) })));
    await settle(corpus);
    expect(tiles[0].rows).toEqual([3, 9]);
  });
});
