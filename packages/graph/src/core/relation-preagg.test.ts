import { MosaicClient, Query, Selection, clauseIntervals, relationOver, type FilterExpr, type TableExpr } from "@kanzo-tech/mosaic";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { regrCount, regrSlope, variance } from "@uwdata/mosaic-sql";
import { describe, expect, it, vi } from "vitest";
import { attach, settle, typeRelation } from "../../test/corpus";

/**
 * **A regression tile over a relation, under a 2-D brush**, through a real coordinator with its
 * pre-aggregator on. A regression's sufficient statistics are mean-centred: mosaic-core rewrites
 * each one with `(SELECT avg(<column>) FROM <base table>)`, where `<column>` is the relation's
 * select expression for that column. So it pre-aggregates only what it can trace to one base table: a
 * type's own table does, and a pattern — `graph.match`'s SQL text — does not, and is answered plainly.
 */

/** A tile fitting `score` against `lon`; its filter is stable, so Mosaic pre-aggregates it where it can. */
class Fit extends MosaicClient {
  result: { slope: number; n: number; variance: number } | null = null;
  readonly #table: TableExpr;
  readonly #score: string;
  readonly #lon: string;
  constructor(filterBy: Selection, table: TableExpr, [score, lon]: readonly [string, string]) {
    super(filterBy);
    this.#table = table;
    this.#score = score;
    this.#lon = lon;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({
      slope: regrSlope(this.#score, this.#lon),
      n: regrCount(this.#score, this.#lon),
      variance: variance(this.#score),
    })
      .from(this.#table)
      .where(filter ?? []);
  }
  override queryResult(data: unknown): this {
    const row = (data as { toArray(): { slope: number; n: number | bigint; variance: number }[] }).toArray()[0]!;
    this.result = { slope: row.slope, n: Number(row.n), variance: row.variance };
    return this;
  }
}

/** A brush over `lon × score` that keeps People 0–4: `lon = i`, `score = i + 1`. */
const brush = ([score, lon]: readonly [string, string]) =>
  clauseIntervals(
    [lon, score],
    [
      [0, 4],
      [1, 5],
    ],
    {
      source: {},
      clients: new Set(),
      scales: [
        { type: "linear", domain: [0, 9], range: [0, 900] },
        { type: "linear", domain: [1, 10], range: [0, 900] },
      ],
    },
  );

async function fit(read: (graph: Graph) => { table: TableExpr; columns: readonly [string, string] }) {
  const corpus = await attach();
  const { coordinator } = corpus;
  const error = vi.fn();
  coordinator.logger({ error, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} } as never);
  const { table, columns } = read(corpus.graph);
  const own = Selection.crossfilter();
  const tile = new Fit(own, table, columns);
  coordinator.connect(tile);
  await settle(corpus);
  const clause = brush(columns);
  own.activate(clause);
  own.update(clause);
  await settle(corpus);
  return { corpus, error, tile, info: coordinator.preaggregator.entries.get(tile) };
}

describe("a regression tile over a relation, brushed in two dimensions", () => {
  it("pre-aggregates a type's own table, and the brush reads the view it created", async () => {
    const { corpus, error, tile, info } = await fit((graph) => ({ table: typeRelation(graph, "Person").table, columns: ["score", "lon"] }));
    expect(error).not.toHaveBeenCalled();
    expect(corpus.sent.some((s) => /CREATE TABLE IF NOT EXISTS "mosaic"\."preagg_/.test(s))).toBe(true);
    expect(info && "result" in info && info.result).toBeTruthy();
    expect(corpus.sent.at(-1)).toMatch(/FROM "mosaic"\."preagg_\w+" WHERE \(\("active0" BETWEEN .+\) AND \("active1" BETWEEN .+\)\)/);
    expect(tile.result).toEqual({ slope: 1, n: 5, variance: 2.5 });
  });

  it("answers a pattern without pre-aggregating it: its SQL text has no base table Mosaic can trace", async () => {
    const pattern = [{ as: "p", type: "Person" }, { edge: "livesIn", direction: "out" }, { as: "home", type: "Place" }] as const;
    const { corpus, error, tile, info } = await fit((graph) => ({ table: relationOver(graph, pattern).table, columns: ["p.score", "p.lon"] }));
    expect(error).not.toHaveBeenCalled();
    expect(info).toBeNull();
    expect(corpus.sent.some((s) => /preagg_/.test(s))).toBe(false);
    expect(tile.result).toEqual({ slope: 1, n: 5, variance: 2.5 });
  });
});
