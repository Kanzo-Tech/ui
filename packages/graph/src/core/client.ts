import {
  MosaicClient,
  type ClauseSource,
  Query,
  cast,
  clauseSemiJoin,
  float64,
  literal,
  onRelation,
  queryFailure,
  type FilterExpr,
  type RelationClient,
  type Selection,
} from "@kanzo-tech/mosaic";
import { VERTICES, clausesOf, verticesOf, type Answer } from "./source";
import { type Structure } from "./structure";

/**
 * **The graph as a client of the page's coordinator** — one Mosaic client, like every chart beside
 * it, reading `vertices`: every vertex as one relation. The coordinator hands it the page's
 * predicate, minus the clause the graph published itself, with every clause published on another
 * relation already crossed into `vertices` by the page's resolver; it answers with the keys that
 * survive, and the canvas greys out the rest on the GPU.
 * No predicate is translated, no position is uploaded again, and the query runs on the coordinator's
 * one connection, through its cache — Cosmograph's crossfilter, on our stack.
 */
/** The answer that clears the filter. */
const UNFILTERED = Query.select({ id: cast(literal(null), "DOUBLE") });

export class GraphClient extends MosaicClient implements RelationClient {
  /** What the page's resolver crosses every other relation's clauses into. */
  readonly relation = VERTICES;
  #structure: () => Structure | null;
  #kept: (ids: Float64Array | null) => void;
  #fail: (error: unknown) => void;
  #cleared: () => void;

  constructor(
    filterBy: Selection | undefined,
    structure: () => Structure | null,
    kept: (ids: Float64Array | null) => void,
    fail: (error: unknown) => void,
    cleared: () => void,
  ) {
    super(filterBy);
    this.#structure = structure;
    this.#kept = kept;
    this.#fail = fail;
    this.#cleared = cleared;
  }

  /**
   * The graph's clause was retracted where it was published — a chip's remove, a page's "Clear" —
   * and mosaic-core calls its source back: the pick goes from the canvas too.
   */
  reset(): void {
    this.#cleared();
  }

  /**
   * Not stable: the answer is a set of ids, not a group-by a pre-aggregate could stand in for. And
   * Mosaic's pre-aggregator calls `query()` with no filter to analyse a client — false keeps it away.
   */
  override get filterStable(): boolean {
    return false;
  }

  /**
   * The surviving ids — or, with nothing to filter by, {@link UNFILTERED}: one row whose id is
   * `NULL`, which no key is. The answer says which it is, so two statements in flight can
   * never be read as each other's.
   */
  override query(filter?: FilterExpr | null): Query {
    const clauses = clausesOf(filter);
    const structure = this.#structure();
    if (!structure || clauses.length === 0) return UNFILTERED;
    // Every clause over every vertex, as one relation: a type without a column a clause names holds
    // `NULL` there, so the clause keeps none of it.
    return Query.select({ id: float64(structure.key) }).from(verticesOf(structure).table).where(clauses);
  }

  override queryResult(data: unknown): this {
    const ids = ((data as Answer).getChild("id")?.toArray() ?? []) as ArrayLike<number | null>;
    this.#kept(ids.length === 1 && ids[0] === null ? null : Float64Array.from(ids as ArrayLike<number>));
    return this;
  }

  override queryError(error: Error): this {
    this.#fail(queryFailure(error));
    return this;
  }
}

/**
 * **A pick, published** — `key IN (ids)` from `source`, labelled for its chip, on the selection the
 * graph filters by, said to be on `vertices`, so the page crosses it into every other relation by key. One clause per source: a source that picks again replaces its own clause, and two
 * sources intersect. The canvas's own gestures publish from the graph's client, which the crossfilter
 * exempts, so a lasso does not grey out the neighbourhood the reader drew it in; a pick from anywhere
 * else — a search, a rule, an answer — filters the graph like any other clause. `null`, or no ids,
 * withdraws the source's clause.
 */
export function publish(
  selection: Selection,
  source: ClauseSource,
  key: string,
  ids: readonly number[] | null,
  label: string,
): void {
  selection.update(onRelation(clauseSemiJoin(key, ids && ids.length > 0 ? ids : null, { source, label }), VERTICES));
}
