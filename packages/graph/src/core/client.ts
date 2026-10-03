import {
  MosaicClient,
  Query,
  cast,
  clausePoints,
  collectColumns,
  float64,
  literal,
  queryFailure,
  type FilterExpr,
  type Selection,
} from "@kanzo-tech/mosaic";
import { GraphError } from "./error";
import { relation, type Answer } from "./source";
import { type Structure } from "./structure";

/**
 * **The graph as a client of the page's coordinator** — one Mosaic client, like every chart beside
 * it. The coordinator hands it the crossfilter's predicate, minus the clause the graph published
 * itself; it answers with the `dense_id`s that survive, and the canvas greys out the rest on the GPU.
 * No predicate is translated, no position is uploaded again, and the query runs on the coordinator's
 * one connection, through its cache — Cosmograph's crossfilter, on our stack.
 */
/** The answer that clears the filter. */
const UNFILTERED = Query.select({ id: cast(literal(null), "DOUBLE") });

export class GraphClient extends MosaicClient {
  #structure: () => Structure | null;
  #kept: (ids: Float64Array | null) => void;
  #fail: (error: unknown) => void;

  constructor(
    filterBy: Selection | undefined,
    structure: () => Structure | null,
    kept: (ids: Float64Array | null) => void,
    fail: (error: unknown) => void,
  ) {
    super(filterBy);
    this.#structure = structure;
    this.#kept = kept;
    this.#fail = fail;
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
   * `NULL`, which no `dense_id` is. The answer says which it is, so two statements in flight can
   * never be read as each other's.
   */
  override query(filter?: FilterExpr | null): Query {
    const clauses = (Array.isArray(filter) ? filter : [filter]).filter((c) => c !== undefined && c !== null);
    const structure = this.#structure();
    if (!structure || clauses.length === 0) return UNFILTERED;
    const named = [...new Set(clauses.flatMap((c) => collectColumns(c as never).map((ref: { column: string }) => ref.column)))];
    // A table that lacks a column the predicate names is not filtered by it — what a `WHERE` over a
    // union of the tables would do. A predicate no table can answer is refused rather than ignored,
    // so the unfiltered picture is never drawn as the filtered one.
    const answering = structure.vertices.filter((t) => named.every((c) => t.columns.has(c)));
    if (answering.length === 0) {
      this.#fail(new GraphError("graph/unfilterable", `no vertex type has every column this clause names: ${named.join(", ")}`));
      return UNFILTERED;
    }
    return Query.unionAll(
      structure.vertices.map((t) =>
        Query.select({ id: float64("dense_id") })
          .from(relation(structure.from, t.name))
          .where(answering.includes(t) ? clauses : []),
      ),
    );
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
 * **The reader's pick, published** — from the graph, so the crossfilter applies it to every chart and
 * skips it for the graph. A canvas that greyed out everything but a lasso of thirteen would hide the
 * neighbourhood the reader was looking at.
 */
export function publish(selection: Selection, self: MosaicClient, ids: readonly number[] | null): void {
  selection.update(
    clausePoints(["dense_id"], ids && ids.length > 0 ? ids.map((d) => [d]) : undefined, {
      source: self,
      clients: new Set([self]),
    }),
  );
}
