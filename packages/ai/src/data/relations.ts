import { count, desc, Query, relationIdentities, relationQuery, type Coordinator, type JoinGraph, type Relation } from "@kanzo-tech/mosaic";
import { plotRelation, queryFieldStats } from "@kanzo-tech/ui/analytics";
import type { AnswerField, AnswerRelation } from "./answer.js";

export interface ReadAnswerRelationsOptions {
  /** How many of a category's most common values the model is told. Default 6. */
  values?: number;
}

/**
 * **The relations an answer may be about, read from the engine**: each one's fields as a dashboard
 * over it reads them — `queryFieldStats` without the keys `relationIdentities` names, then
 * `plotRelation` — and each category's most common values, which are what the model is told a field
 * holds in place of DDL. One `SUMMARIZE` per relation and one count per category.
 */
export async function readAnswerRelations(
  coordinator: Coordinator,
  graph: JoinGraph,
  relations: readonly Relation[],
  options: ReadAnswerRelationsOptions = {},
): Promise<AnswerRelation[]> {
  const { values = 6 } = options;
  return Promise.all(
    relations.map(async (relation) => {
      const table = relationQuery(graph, relation);
      const exclude = relationIdentities(graph, relation).map((i) => i.column);
      const stats = await queryFieldStats(coordinator, table, { exclude });
      const plotted = plotRelation(table, stats);
      const fields = await Promise.all(
        plotted.fields.map(async (field): Promise<AnswerField> => {
          if (field.kind !== "categorical" || field.role !== "dimension") return field;
          const top = Query.from(plotted.table).select({ value: field.name, n: count() }).groupby(field.name).orderby(desc("n")).limit(values);
          const rows = Array.from((await coordinator.query(top)) as Iterable<{ value: unknown }>);
          return { ...field, values: rows.filter((row) => row.value != null).map((row) => String(row.value)) };
        }),
      );
      return { relation, columns: stats.columns, fields };
    }),
  );
}
