import { MosaicClient, clausePoints, type Selection } from "@uwdata/mosaic-core";
import { Query, type FilterExpr } from "@uwdata/mosaic-sql";

// cosmos.gl as a Mosaic client.
//
// A renderer becomes a crossfilter participant by answering two questions, and this file is both:
//
//   query(filter) — "which rows survive the page's filters?"  The coordinator answers with a column
//     of ids, the view greys out everything else. This is the *observable* half.
//   publish(ids)  — "the user drew a lasso around these."  A points clause, `id IN (…)`, which
//     every other chart on the page filters by. The *controllable* half.
//
// The id list is not a shortcut, it is the only thing a lasso can say. A Plot brush publishes
// `weight BETWEEN …`, an interval in data space, because Plot's x is a column. cosmos.gl's x is a
// GPU simulation: the position exists nowhere in the database, so the selection cannot be expressed
// as a predicate over columns. Enumerating what was hit is the honest translation — and its cost is
// the length of the `IN` list, which is the real ceiling on this route.

export interface CosmosClientOptions {
  /** The node relation. Its `idField` column is what gets published and matched. */
  table: string;
  idField: string;
  /** What the view greys out by. */
  filterBy: Selection;
  /** Where the lasso publishes. */
  as: Selection;
  /** The surviving ids, in relation order, on every filter change. */
  onSurvivors: (ids: readonly unknown[]) => void;
}

/** Arrow gives us a typed column when it can; a string/dictionary column needs the row walk. */
function idColumn(data: unknown, field: string): readonly unknown[] {
  const table = data as { getChild?: (name: string) => { toArray(): ArrayLike<unknown> } | null };
  const child = table.getChild?.(field);
  if (child) return Array.from(child.toArray());
  return Array.from(data as Iterable<Record<string, unknown>>, (row) => row[field]);
}

export class CosmosClient extends MosaicClient {
  #table: string;
  #idField: string;
  #as: Selection;
  #emit: (ids: readonly unknown[]) => void;

  constructor(options: CosmosClientOptions) {
    super(options.filterBy);
    this.#table = options.table;
    this.#idField = options.idField;
    this.#as = options.as;
    this.#emit = options.onSurvivors;
  }

  override query(filter: FilterExpr = []) {
    return Query.from(this.#table).select({ id: this.#idField }).where(filter);
  }

  override queryResult(data: unknown): this {
    this.#emit(idColumn(data, "id"));
    return this;
  }

  /** `null` retracts the lasso: an empty clause has a null predicate, which the resolver drops. */
  publish(ids: readonly unknown[] | null): void {
    this.#as.update(
      clausePoints([this.#idField], ids?.map((id) => [id]), {
        source: this,
        // A crossfilter normally exempts a client from its own clause, so you can widen a brush
        // after it has collapsed the chart under it. cosmos.gl does not need the exemption: an
        // excluded point is greyed, not removed, so it is still on screen and still lassoable.
        // Declining it is what makes the lasso *visible* — the greyout is the brush.
        clients: new Set<MosaicClient>(),
      }),
    );
  }
}
