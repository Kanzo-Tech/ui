import { count, desc, Query, relationHops, relationIdentities, relationQuery, type Coordinator, type JoinGraph, type Relation } from "@kanzo-tech/mosaic";
import { fieldStats, plotRelation, type SummarizeRow } from "@kanzo-tech/ui/analytics";
import type { AnswerField, AnswerRelation } from "./answer.js";

export interface AnswerRelationsOfOptions {
  /**
   * The types the relations start from, in the graph's order whatever the order here. Default every
   * type.
   */
  from?: readonly string[];
  /** `0` is each type alone; `1` is each type alone and through each of its hops. Default 1. */
  hops?: 0 | 1;
}

/**
 * **The relations a reader of a join graph may ask about**: each type alone and, at `hops: 1`, through
 * each of its hops, as `RelationPicker` first offers them. Each relation is one `SUMMARIZE` and a count
 * per category when `readAnswerRelations` reads it, and a list of fields in every prompt, so a hop is
 * the expensive part: `/docs/design/ai` has what it measured to cost.
 */
export function answerRelationsOf(graph: JoinGraph, options: AnswerRelationsOfOptions = {}): Relation[] {
  const { from, hops = 1 } = options;
  return graph.types
    .filter(({ name }) => from === undefined || from.includes(name))
    .flatMap(({ name }) => [
      { root: name, path: [] },
      ...(hops === 0 ? [] : relationHops(graph, name).map(({ hop }) => ({ root: name, path: [hop] }))),
    ]);
}

export interface ReadAnswerRelationsOptions {
  /** How many of a category's most common values the model is told. Default 6. */
  values?: number;
  /**
   * Ends the read: once the statement running lands, the queries still queued on the coordinator are
   * cancelled and it rejects with the signal's reason. Each query is handed the signal too, for a
   * connector that stops one in flight.
   */
  signal?: AbortSignal;
}

/**
 * **The relations an answer may be about, read from the engine**: each one's fields as a dashboard
 * over it reads them — `fieldStats` over its `SUMMARIZE`, without the keys `relationIdentities` names,
 * then `plotRelation` — and each category's most common values, which are what the model is told a
 * field holds in place of DDL. One `SUMMARIZE` per relation and one count per category.
 */
export async function readAnswerRelations(
  coordinator: Coordinator,
  graph: JoinGraph,
  relations: readonly Relation[],
  options: ReadAnswerRelationsOptions = {},
): Promise<AnswerRelation[]> {
  const { values = 6, signal } = options;
  signal?.throwIfAborted();
  const asked: ReturnType<Coordinator["query"]>[] = [];
  const ask = async (query: Query | string): Promise<Iterable<Record<string, unknown>>> => {
    signal?.throwIfAborted();
    const result = coordinator.query(query, { signal });
    asked.push(result);
    const rows = (await result) as Iterable<Record<string, unknown>>;
    // DuckDB-WASM's connector stops nothing it has started, so an abort is seen as each statement
    // lands: the rest still queued are cancelled, and the read ends with the signal's reason.
    if (signal?.aborted) {
      coordinator.cancel(asked);
      throw signal.reason;
    }
    return rows;
  };
  return Promise.all(
    relations.map(async (relation) => {
      const table = relationQuery(graph, relation);
      const exclude = relationIdentities(graph, relation).map((i) => i.column);
      // `queryFieldStats`' read, written out because it takes no signal: the summary is a statement
      // mosaic-sql has no node for, around a query over the relation.
      const summary = await ask(`SUMMARIZE ${Query.select("*").from(table)}`);
      const stats = fieldStats(Array.from(summary) as unknown as SummarizeRow[], { exclude });
      const plotted = plotRelation(table, stats);
      const fields = await Promise.all(
        plotted.fields.map(async (field): Promise<AnswerField> => {
          if (field.kind !== "categorical" || field.role !== "dimension") return field;
          const top = Query.from(plotted.table).select({ value: field.name, n: count() }).groupby(field.name).orderby(desc("n")).limit(values);
          const rows = Array.from((await ask(top)) as Iterable<{ value: unknown }>);
          return { ...field, values: rows.filter((row) => row.value != null).map((row) => String(row.value)) };
        }),
      );
      return { relation, columns: stats.columns, fields };
    }),
  );
}
