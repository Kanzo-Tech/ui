"use client";

import { ark } from "@ark-ui/react/factory";
import {
  clausePoints,
  clauseSemiJoin,
  Query,
  relationIdentities,
  relationKey,
  relationQuery,
  semiJoinOf,
  type JoinGraph,
  type SelectionClause,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { LayoutDashboardIcon, ListFilterIcon } from "lucide-react";
import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn, DiagnosticList, Problem, Skeleton } from "@kanzo-tech/ui";
import {
  autoDashboard,
  ChartCard,
  DashboardStat,
  DetailTable,
  plotRelation,
  useClauses,
  useFieldStats,
  useMosaic,
  type DashboardSpec,
  type FieldStat,
} from "@kanzo-tech/ui/analytics";
import type { ToolPart } from "../tool.js";
import type { AnswerOutput } from "./agent.js";
import { conditionClauses } from "./answer.js";

/** Every word `AnswerCard` draws. English by default. */
export interface AnswerCardTranslations {
  /** Narrows the page to what the answer is about. */
  filter: string;
  /** The same button while the page is narrowed to it. */
  filtered: string;
  /** What a chip of the page's filter calls the answer's clause. */
  label: string;
  add: string;
  added: string;
  /** The failure's title, over its words. */
  failed: string;
  /** A table's title. */
  rows: string;
}

const ENGLISH: AnswerCardTranslations = {
  filter: "Filter to it",
  filtered: "✓ Filtered to it",
  label: "Ask",
  add: "Add to the dashboard",
  added: "✓ On the dashboard",
  failed: "The answer failed",
  rows: "Rows",
};

export interface AnswerCardProps extends Omit<React.ComponentProps<typeof ark.div>, "children" | "part"> {
  /** The `answer` call, as `Chat`'s `tools` hands it over, at whatever state it is in. */
  part: ToolPart;
  /** The call will never settle — `Chat`'s `stopped`. */
  stopped?: boolean;
  /** The join graph the agent was given: the answer's relation is compiled over it. */
  graph: JoinGraph;
  /**
   * Makes *Add to the dashboard* an action. Called with the relation's key (`relationKey`, what a
   * host keeps its dashboards by) and `add`, which answers the relation's spec with the tile
   * appended — to the automatic one when `spec` is `undefined`, as `Dashboard` would draw it.
   */
  onAdd?: (key: string, add: (spec: DashboardSpec | undefined) => DashboardSpec) => void;
  translations?: Partial<AnswerCardTranslations>;
}

/** The states of a call still at work: the model writing the answer, or the engine reading it. */
const RUNNING = new Set<ToolPart["state"]>(["input-streaming", "input-available", "approval-responded"]);

/**
 * **A `dataAgent` answer, drawn as the dashboard tile it is**: `ChartCard`, `DashboardStat` or a
 * `DetailTable`, over the answer's relation narrowed by its conditions, under the page's crossfilter
 * like every tile — what the reader filters afterwards, the card follows. Nothing in it is SQL a
 * transcript carried: a kept answer is names, compiled again over the host's graph.
 *
 * Two actions fall out of the shape. **Filter to it** narrows the page to the answer — its
 * conditions, and the categories its bars answered — as one semi-join on the relation's root key,
 * so the graph and every relation keyed the same way follow. **Add to the dashboard** hands the host
 * the relation's spec with the tile in it.
 *
 * The card is `aria-busy` while the model writes the answer and the engine reads it, over a skeleton
 * the chart's height. A refusal — input the schema refused, or the engine's failure — is a `Problem`.
 */
export function AnswerCard(props: AnswerCardProps) {
  const { part, stopped = false, graph, onAdd, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const output = part.state === "output-available" ? (part.output as AnswerOutput) : null;
  const running = !stopped && RUNNING.has(part.state);

  return (
    <ark.div
      aria-busy={running || undefined}
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "answer-card"}
    >
      {output && <Answered graph={graph} onAdd={onAdd} output={output} t={t} />}
      {part.state === "output-error" && <Failure error={{ message: part.errorText }} t={t} />}
      {running && <Skeleton className="h-[220px] w-full" slot="answer-card-pending" />}
    </ark.div>
  );
}

function Failure(props: { error: unknown; t: AnswerCardTranslations }) {
  const { error, t } = props;
  const message = error instanceof Error ? error.message : (error as { message?: string }).message ?? String(error);
  return (
    <DiagnosticList>
      <Problem error={{ message, title: t.failed }} />
    </DiagnosticList>
  );
}

/** The answer's relation, compiled over the host's graph — which may no longer have it. */
function Answered(props: {
  graph: JoinGraph;
  output: AnswerOutput;
  onAdd?: AnswerCardProps["onAdd"];
  t: AnswerCardTranslations;
}) {
  const { graph, output, t } = props;
  const relation = output.answer.relation;
  const compiled = React.useMemo(() => {
    try {
      return { table: relationQuery(graph, relation), name: relationKey(graph, relation), identities: relationIdentities(graph, relation) };
    } catch (error) {
      return { error };
    }
  }, [graph, relation]);
  if ("error" in compiled) return <Failure error={compiled.error} t={t} />;
  return <Drawn {...props} {...compiled} />;
}

function Drawn(props: {
  table: TableExpr;
  /** The relation's key: what a host keeps its dashboards by. */
  name: string;
  identities: { column: string }[];
  output: AnswerOutput;
  onAdd?: AnswerCardProps["onAdd"];
  t: AnswerCardTranslations;
}) {
  const { table, identities, output, onAdd, t } = props;
  // The fields a dashboard over the relation reads, so the tile it is added to is drawn the same.
  const stats = useFieldStats(table, { exclude: identities.map((i) => i.column) });
  const readable = React.useMemo(
    () => (stats.fields && stats.columns ? plotRelation(table, { fields: stats.fields, columns: stats.columns }) : null),
    [table, stats.fields, stats.columns],
  );
  const narrowed = React.useMemo(() => {
    if (!readable) return null;
    const clauses = conditionClauses(output.answer.where, readable.fields, {});
    const ranked = output.answer.top === undefined ? null : domainClause(output, readable.fields, {});
    return { clauses, table: Query.from(readable.table).select("*").where([...clauses, ...(ranked ? [ranked] : [])].map((c) => c.predicate!)) };
  }, [readable, output]);

  if (stats.error !== null) return <Failure error={stats.error} t={t} />;
  if (!readable || !narrowed) return <Skeleton className="h-[220px] w-full" />;
  const tile = output.answer.show;
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1" data-slot="answer-card-actions">
        <FilterToIt identity={identities[0]!.column} output={output} fields={readable.fields} t={t} table={table} />
        {onAdd && <AddToDashboard fields={readable.fields} onAdd={onAdd} relationKey={props.name} output={output} t={t} />}
      </div>
      {tile.kind === "chart" ? (
        <ChartCard card={tile} fields={readable.fields} table={narrowed.table} />
      ) : tile.kind === "stat" ? (
        <DashboardStat fields={readable.fields} stat={tile} table={narrowed.table} />
      ) : (
        <Card className="[--space:--spacing(4)] min-w-0 gap-3">
          <CardHeader>
            <CardTitle className="truncate font-medium text-sm">{tile.title ?? t.rows}</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailTable columns={tile.columns} fields={readable.fields} table={narrowed.table} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * The categories a bar chart answered, as the clause a pick on its bars publishes — `null` for any
 * other tile, and for an answer the cap cut short, whose categories are not all there.
 */
function domainClause(output: AnswerOutput, fields: readonly FieldStat[], source: object): SelectionClause | null {
  const { show } = output.answer;
  if (show.kind !== "chart" || show.type !== "bar" || output.truncated) return null;
  if (fields.find((f) => f.name === show.x)?.kind !== "categorical") return null;
  const values = [...new Set(output.rows.map((row) => row[show.x]))];
  return clausePoints([show.x], values.map((v) => [v]), { source });
}

/**
 * The answer's conditions and its bars' categories, published to the page as one semi-join on the
 * relation's root key: a column clause would filter only what has the relation's columns, and the
 * key is what the page shares. Pressed again, it takes the clause back.
 */
function FilterToIt(props: {
  table: TableExpr;
  identity: string;
  output: AnswerOutput;
  fields: readonly FieldStat[];
  t: AnswerCardTranslations;
}) {
  const { table, identity, output, fields, t } = props;
  const { crossfilter } = useMosaic();
  // Its own source, so its chip retracts it and nothing else.
  const [source] = React.useState(() => ({ reset() {} }));
  const held = useClauses(crossfilter).some((clause) => clause.source === source);
  const domain = domainClause(output, fields, source);
  const clauses = [...conditionClauses(output.answer.where, fields, source), ...(domain ? [domain] : [])];
  if (clauses.length === 0) return null;
  return (
    <Button
      aria-pressed={held}
      onClick={() =>
        crossfilter.update(held ? clauseSemiJoin(identity, null, { source }) : semiJoinOf(identity, table, { label: t.label })(clauses, source))
      }
      size="sm"
      variant="ghost"
    >
      <ListFilterIcon />
      {held ? t.filtered : t.filter}
    </Button>
  );
}

function AddToDashboard(props: {
  relationKey: string;
  output: AnswerOutput;
  fields: readonly FieldStat[];
  onAdd: NonNullable<AnswerCardProps["onAdd"]>;
  t: AnswerCardTranslations;
}) {
  const { relationKey: key, output, fields, onAdd, t } = props;
  const [added, setAdded] = React.useState(false);
  const add = () => {
    onAdd(key, (spec) => {
      const current = spec ?? autoDashboard(fields);
      // Its own id on the dashboard: the answer's is the tool call's, and one answer may be added twice.
      return { ...current, tiles: [...current.tiles, { ...output.answer.show, id: globalThis.crypto.randomUUID() }] };
    });
    setAdded(true);
  };
  return (
    <Button disabled={added} onClick={add} size="sm" variant="ghost">
      <LayoutDashboardIcon />
      {added ? t.added : t.add}
    </Button>
  );
}
