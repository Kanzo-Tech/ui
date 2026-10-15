import { MosaicClient, Query, clauseInterval, count, type FilterExpr, type Selection, type TableExpr } from "@kanzo-tech/mosaic";
import { crossfilterOver, onRelation, preaggregateOwnRelation, readOf, type RelationClient, type RelationRef } from "@kanzo-tech/relations";
import { describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readJoinGraph } from "@kanzo-tech/relations";

/**
 * **Pre-aggregation on the page's one selection**, through a real coordinator with its pre-aggregator
 * on. Mosaic's pre-aggregator indexes the *active* clause's columns against the client's own table. A
 * clause published on another relation is crossed into the client by the resolver, so a view indexed
 * by its columns against this table is the wrong view — and where a column of the same name exists,
 * it is silently wrong. `preaggregateOwnRelation` keeps the pre-aggregator to a client of the clause's
 * own relation; a crossed client asks the plain query.
 *
 * The corpus: Place `i` (ids 10–15) has `lon = i, lat = 1`; Person `i` (0–9) has `lon = i, lat = 0`.
 */

/** A histogram tile: rows per `lat`. Group-by and `count` only, so Mosaic can pre-aggregate it. */
class Histogram extends MosaicClient implements RelationClient {
  rows: { lat: number; n: number }[] | null = null;
  readonly #table: TableExpr;
  constructor(
    filterBy: Selection,
    readonly relation: RelationRef,
    table: TableExpr,
  ) {
    super(filterBy);
    this.#table = table;
  }
  override query(filter?: FilterExpr | null): Query {
    return Query.select({ lat: "lat", n: count() }).from(this.#table).where(filter ?? []).groupby("lat");
  }
  override queryResult(data: unknown): this {
    const rows = (data as { toArray(): { lat: number; n: number | bigint }[] }).toArray();
    this.rows = rows.map((r) => ({ lat: Number(r.lat), n: Number(r.n) })).sort((a, b) => a.lat - b.lat);
    return this;
  }
}

async function brushPlaces(guarded: boolean) {
  const corpus = await attach();
  const { coordinator } = corpus;
  const error = vi.fn();
  coordinator.logger({ error, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} } as never);
  const joins = await readJoinGraph(corpus.engine, corpus.from, { signal: new AbortController().signal });
  if (guarded) preaggregateOwnRelation(coordinator);
  const page = crossfilterOver(joins);
  // A tile of places, which publishes the brush, and one beside it: same relation, pre-aggregated.
  const brusher = new Histogram(page, "Place", readOf(joins, "Place").table);
  const places = new Histogram(page, "Place", readOf(joins, "Place").table);
  // A tile over every vertex: the brush reaches it crossed.
  const vertices = new Histogram(page, "vertices", readOf(joins, "vertices").table);
  // And a tile of people: a single table, which Mosaic would pre-aggregate, with a `lon` of its own.
  const people = new Histogram(page, "Person", readOf(joins, "Person").table);
  for (const client of [brusher, places, vertices, people]) coordinator.connect(client);
  await settle(corpus);
  const brush = onRelation(
    clauseInterval("lon", [1, 3], {
      source: brusher,
      clients: new Set([brusher]),
      scale: { type: "linear", domain: [0, 9], range: [0, 900] },
    }),
    "Place",
  );
  page.activate(brush);
  page.update(brush);
  await settle(corpus);
  const entries = coordinator.preaggregator.entries;
  return { corpus, error, people, places, vertices, entry: (client: MosaicClient) => entries.get(client) };
}

describe("pre-aggregation on the page's one selection", () => {
  it("pre-aggregates a client of the clause's own relation, and asks a crossed one the plain query", async () => {
    const { corpus, error, entry, people, places, vertices } = await brushPlaces(true);
    expect(error).not.toHaveBeenCalled();
    // The same relation: a materialised view, and the brush read from it.
    const own = entry(places);
    expect(own && "result" in own && own.result).toBeTruthy();
    expect(corpus.sent.some((s) => /FROM "mosaic"\."preagg_\w+" WHERE \("active0" BETWEEN/.test(s))).toBe(true);
    expect(places.rows).toEqual([{ lat: 1, n: 3 }]);
    // Crossed: never asked of the pre-aggregator, and read through the semi-join — Places 11–13.
    expect(entry(vertices)).toBeUndefined();
    expect(corpus.sent.some((s) => /IN \(SELECT "dense_id" FROM .*"Place".*"lon" BETWEEN 1 AND 3/.test(s))).toBe(true);
    expect(vertices.rows).toEqual([{ lat: 1, n: 3 }]);
    // No person is a place: the brush keeps none of them.
    expect(entry(people)).toBeUndefined();
    expect(people.rows).toEqual([]);
  });

  it("would index a crossed client by a column of the same name on its own table without it — the wrong rows", async () => {
    // Mosaic alone: the view of people is built on their own `lon`, so People 1–3 count, as places.
    const { entry, people } = await brushPlaces(false);
    const view = entry(people);
    expect(view && "result" in view && view.result).toBeTruthy();
    expect(people.rows).toEqual([{ lat: 0, n: 3 }]);
  });
});
