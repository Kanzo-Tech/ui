import { MosaicClient, Query, Selection, clauseIntervals, relationQuery, type FilterExpr, type TableExpr } from "@kanzo-tech/mosaic";
import { regrCount, regrSlope, variance } from "@uwdata/mosaic-sql";
import { describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readJoinGraph } from "./join-graph";
import type { Relation } from "@kanzo-tech/mosaic";

/**
 * **A regression tile over a relation, under a 2-D brush**, through a real coordinator with its
 * pre-aggregator on. A regression's sufficient statistics are mean-centred: mosaic-core rewrites
 * each one with `(SELECT avg(<column>) FROM <base table>)`, where `<column>` is the relation's
 * select expression for that column. So the relation must name its columns the way the base table
 * names them, or the materialised view is never created and every brush reads a table that does not
 * exist.
 */

/** A tile fitting `score` against `lon`; its filter is stable, so Mosaic pre-aggregates it. */
class Fit extends MosaicClient {
  result: { slope: number; n: number; variance: number } | null = null;
  readonly #table: TableExpr;
  constructor(filterBy: Selection, table: TableExpr) {
    super(filterBy);
    this.#table = table;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({
      slope: regrSlope("Person.score", "Person.lon"),
      n: regrCount("Person.score", "Person.lon"),
      variance: variance("Person.score"),
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
const brush = () =>
  clauseIntervals(
    ["Person.lon", "Person.score"],
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

async function fit(relation: Relation) {
  const corpus = await attach();
  const { coordinator } = corpus;
  const error = vi.fn();
  coordinator.logger({ error, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} } as never);
  const table = relationQuery(await readJoinGraph(coordinator, corpus.from), relation);
  const own = Selection.crossfilter();
  const tile = new Fit(own, table);
  coordinator.connect(tile);
  await settle(corpus);
  const clause = brush();
  own.activate(clause);
  own.update(clause);
  await settle(corpus);
  return { corpus, error, tile, info: coordinator.preaggregator.entries.get(tile) };
}

describe("a regression tile over a relation, brushed in two dimensions", () => {
  it("pre-aggregates a type on its own, and the brush reads the view it created", async () => {
    const { corpus, error, tile, info } = await fit({ root: "Person", path: [] });
    expect(error).not.toHaveBeenCalled();
    expect(corpus.sent.some((s) => /CREATE TABLE IF NOT EXISTS "mosaic"\."preagg_/.test(s))).toBe(true);
    expect(info && "result" in info && info.result).toBeTruthy();
    expect(corpus.sent.at(-1)).toMatch(/FROM "mosaic"\."preagg_\w+" WHERE \(\("active0" BETWEEN .+\) AND \("active1" BETWEEN .+\)\)/);
    expect(tile.result).toEqual({ slope: 1, n: 5, variance: 2.5 });
  });

  it("answers a relation with a path without pre-aggregating it: a join has no single base table", async () => {
    const { corpus, error, tile, info } = await fit({ root: "Person", path: [{ edge: "Person_livesIn_Place", direction: "out" }] });
    expect(error).not.toHaveBeenCalled();
    expect(info).toBeNull();
    expect(corpus.sent.some((s) => /preagg_/.test(s))).toBe(false);
    expect(tile.result).toEqual({ slope: 1, n: 5, variance: 2.5 });
  });
});
