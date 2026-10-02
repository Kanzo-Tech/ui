import { ConnectedMark, Mark } from "@uwdata/mosaic-plot";
import { cte, isAggregateExpression, literal, Query, sum, type FilterExpr, type SelectQuery } from "@uwdata/mosaic-sql";

/**
 * A stacked area needs every series at every step. Observable Plot stacks what it is given, and an
 * aggregating query only returns the (step, series) groups that have rows — so a series missing from
 * one bucket drops out of that bucket's stack, every layer above it falls by its height there, and
 * the area comes out jagged. Plot's own answer for its binning transforms is to keep the empty bins
 * (`filter: null`); for a stack read from SQL that is completing the grid in the query.
 */

const STACK = "__stack";

/**
 * The aggregate query, completed with a zero for every (step, series) pair it lacks. The steps and
 * the series are the ones the filtered query answered with, so a filter never invents a step or a
 * series — it only stops one from vanishing between its neighbours.
 */
export function denseStack(query: SelectQuery, along: string): Query {
  if (query._groupby.length === 0) return query;
  const dims: string[] = [];
  const measures: string[] = [];
  for (const { alias, expr } of query._select) (isAggregateExpression(expr) ? measures : dims).push(alias);
  const series = dims.filter((dim) => dim !== along);
  if (!dims.includes(along) || series.length === 0 || measures.length === 0) return query;

  const zeros = Query.from(Query.from(STACK).select(along).distinct(), Query.from(STACK).select(...series).distinct())
    .select(...dims, Object.fromEntries(measures.map((m) => [m, literal(0)])));
  return Query.with(cte(STACK, query, true))
    .from(Query.unionAll(Query.from(STACK).select(...dims, ...measures), zeros))
    .select(...dims, Object.fromEntries(measures.map((m) => [m, sum(m)])))
    .groupby(dims)
    .orderby(along);
}

/**
 * `areaY` / `areaX` stacked by a series column, as a Mosaic client whose query is `denseStack`ed.
 * It skips `ConnectedMark`'s M4 rewrite, which reduces one series' points per pixel and has no
 * notion of a stack, and opts out of pre-aggregation, whose rewrite expects the plain group-by.
 */
export class DenseStackMark extends ConnectedMark {
  override get filterStable(): boolean {
    return false;
  }

  override query(filter: FilterExpr = []) {
    const query = Mark.prototype.query.call(this, filter) as SelectQuery | null;
    // The output column of the stacking axis: the channel's name for a computed `x`, the column's own
    // for a plain one (`SELECT "hour", …`).
    const dim = (this as unknown as { dim: string | null }).dim;
    const along = dim ? this.channelField(dim)?.as : undefined;
    return query && along ? denseStack(query, along) : query;
  }
}
