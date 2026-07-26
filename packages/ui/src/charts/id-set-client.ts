import { MosaicClient, clausePoints, type Selection } from "@uwdata/mosaic-core";
import { Query, type FilterExpr } from "@uwdata/mosaic-sql";
import { column } from "./arrow.js";

/**
 * The crossfilter adapter for a view whose positions are not in the database.
 *
 * A `MosaicClient` asks for two things, and this is both:
 *
 *   `query(filter)` — which rows survive the page's filters? The coordinator answers with a column
 *     of ids, and the view fades everything else. The **observable** half.
 *   `publish(ids)` — the user selected these. A points clause, `id IN (…)`, which every other chart
 *     on the page filters by. The **controllable** half.
 *
 * The id list is not a shortcut, it is the only thing such a view can say. A Plot brush publishes
 * `weight BETWEEN …`, an interval in data space, because Plot's `x` IS a column. A GPU simulation's
 * `x` exists nowhere in the database, so no predicate over columns can describe the loop the user
 * drew. Enumerating what was hit is the honest translation — and its cost is the length of the `IN`
 * list, which is the real ceiling on the whole approach.
 *
 * Nothing here knows what draws. It is named for what it exchanges rather than for the renderer it
 * was first written against, because a canvas, a map and an imperative widget all reach the
 * crossfilter through exactly this shape.
 */

export interface IdSetClientOptions {
  /** The relation. Its `idField` column is what gets published and matched. */
  table: string;
  idField: string;
  /** What the view fades by. */
  filterBy: Selection;
  /** Where the selection publishes. */
  as: Selection;
  /** The surviving ids, in relation order, on every filter change. */
  onSurvivors: (ids: readonly unknown[]) => void;
}

export class IdSetClient extends MosaicClient {
  #table: string;
  #idField: string;
  #as: Selection;
  #emit: (ids: readonly unknown[]) => void;

  constructor(options: IdSetClientOptions) {
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
    this.#emit(column(data, "id"));
    return this;
  }

  /** `null` retracts the selection: an empty clause has a null predicate, which the resolver drops. */
  publish(ids: readonly unknown[] | null): void {
    this.#as.update(
      clausePoints([this.#idField], ids?.map((id) => [id]), {
        source: this,
        // A crossfilter normally exempts a client from its own clause, so a brush can be widened
        // after it has collapsed the chart under it. A view that FADES an excluded row instead of
        // removing it does not need the exemption: the row is still on screen and still
        // selectable. Declining it is what makes the selection visible — the fade is the brush.
        clients: new Set<MosaicClient>(),
      }),
    );
  }
}
