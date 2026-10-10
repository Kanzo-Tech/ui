"use client";

import { ark } from "@ark-ui/react/factory";
import {
  clausePoints,
  clauseSemiJoin,
  Query,
  relationIdentities,
  relationKey,
  relationQuery,
  relationRootKey,
  semiJoinOf,
  type JoinGraph,
  type Relation,
  type SelectionClause,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { LayoutDashboardIcon, ListFilterIcon } from "lucide-react";
import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn, DiagnosticList, Problem, Skeleton, type ProblemProps } from "@kanzo-tech/ui";
import {
  autoDashboard,
  ChartCard,
  DashboardStat,
  DetailTable,
  plotRelation,
  useClauses,
  useFieldStats,
  useMosaic,
  type Dashboards,
  type FieldStat,
} from "@kanzo-tech/ui/analytics";
import type { ToolPart } from "../tool.js";
import type { AnswerOutput } from "./agent.js";
import { conditionClauses, skippedText } from "./answer.js";

/** Every word `AnswerCard` draws. English by default. */
export interface AnswerCardTranslations {
  /** Narrows the page to what the answer is about. */
  filter: string;
  /** The same button while the page is narrowed to it. */
  filtered: string;
  /** What a chip of the page's filter calls the answer's clause. */
  label: string;
  add: string;
  /** The same button while the host writes the tile. */
  adding: string;
  added: string;
  /** The failure's title, over its words. */
  failed: string;
  /** A table's title. */
  rows: string;
  /** Before the page's clauses the answer was read under. */
  under: string;
  /** Before the page's clauses its relation could not answer, each with the fields it lacks. */
  skipped: string;
}

const ENGLISH: AnswerCardTranslations = {
  filter: "Filter to it",
  filtered: "✓ Filtered to it",
  label: "Ask",
  add: "Add to the dashboard",
  adding: "Adding to the dashboard…",
  added: "✓ On the dashboard",
  failed: "The answer failed",
  rows: "Rows",
  under: "Read under the page's filter:",
  skipped: "Not applied, as this relation lacks the fields they filter:",
};

export type AnswerCardProps = Omit<React.ComponentProps<typeof ark.div>, "children" | "part"> & {
  /** The `answer` call, as `Chat`'s `tools` hands it over, at whatever state it is in. */
  part: ToolPart;
  /** The call will never settle — `Chat`'s `stopped`. */
  stopped?: boolean;
  /** The join graph the agent was given: the answer's relation is compiled over it. */
  graph: JoinGraph;
  /** The host's words for a coded failure, as `Problem` takes them. */
  copy?: ProblemProps["copy"];
  translations?: Partial<AnswerCardTranslations>;
} & AnswerCardAdding;

/**
 * *Add to the dashboard*: both or neither. The next document is built from `dashboards`, so a write
 * without it would replace every other relation's spec with nothing.
 */
type AnswerCardAdding =
  | { dashboards?: never; onAdd?: never }
  | {
      /**
       * The host's saved dashboards, a spec per relation, as it draws them: the tile is *On the
       * dashboard* while its relation's spec holds it, so a remount still says so, and a removal saved
       * offers it again.
       */
      dashboards: Dashboards;
      /**
       * Makes *Add to the dashboard* an action. Called with the whole next document — `dashboards`
       * with the tile appended to the answer's relation's spec, or to its automatic dashboard when it
       * has none, as `Dashboard` would draw it — and where it landed. A promise holds the button
       * pending until it settles, and a rejection is drawn as a `Problem`.
       */
      onAdd: (next: Dashboards, added: AnswerAdded) => void | Promise<unknown>;
    };

/** Where *Add to the dashboard* put the tile. */
export interface AnswerAdded {
  /** The answer's relation, as the model named it: what a host's dashboard view is driven by. */
  relation: Relation;
  /** `relationKey(graph, relation)`: what a host keeps its dashboards by. */
  key: string;
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
 * its dashboards with the tile in the relation's spec, and reads whether it is there off what the
 * host hands back.
 *
 * The card is `aria-busy` while the model writes the answer and the engine reads it, over a skeleton
 * the chart's height. A refusal — input the schema refused, or the engine's failure — is a `Problem`.
 */
export function AnswerCard(props: AnswerCardProps) {
  const { part, stopped = false, graph, dashboards, onAdd, copy, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const output = part.state === "output-available" ? (part.output as AnswerOutput) : null;
  const running = !stopped && RUNNING.has(part.state);
  // Busy from the first render an answer is there, so it is never idle over the skeleton between the
  // answer landing and its fields being read; what draws the tile or its failure says when it is done.
  const [drawing, setDrawing] = React.useState(true);

  return (
    <ark.div
      aria-busy={running || (output !== null && drawing) || undefined}
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "answer-card"}
    >
      {output && (
        <Answered adding={onAdd && dashboards && { dashboards, onAdd, copy }} graph={graph} onDrawing={setDrawing} output={output} t={t} />
      )}
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
/** Whether the card still draws the skeleton in its tile's place: `aria-busy` is the card's root's. */
type OnDrawing = (drawing: boolean) => void;

function Answered(props: { graph: JoinGraph; output: AnswerOutput; adding?: Adding; onDrawing: OnDrawing; t: AnswerCardTranslations }) {
  const { graph, output, onDrawing, t } = props;
  const relation = output.answer.relation;
  const compiled = React.useMemo(() => {
    try {
      return { table: relationQuery(graph, relation), dashboardKey: relationKey(graph, relation), identities: relationIdentities(graph, relation), rootKey: relationRootKey(graph, relation) };
    } catch (error) {
      return { error };
    }
  }, [graph, relation]);
  const failed = "error" in compiled;
  React.useLayoutEffect(() => {
    if (failed) onDrawing(false);
  }, [failed, onDrawing]);
  if ("error" in compiled) return <Failure error={compiled.error} t={t} />;
  return <Drawn {...props} {...compiled} />;
}

/** What *Add to the dashboard* reads and writes: the host's document, its write, and its words for a failure. */
interface Adding {
  dashboards: Dashboards;
  onAdd: (next: Dashboards, added: AnswerAdded) => void | Promise<unknown>;
  copy?: ProblemProps["copy"];
}

function Drawn(props: {
  table: TableExpr;
  /** The relation's key: what a host keeps its dashboards by. Not `key`, which React keeps for itself. */
  dashboardKey: string;
  identities: { column: string }[];
  /** The relation's root key, by name: what *Filter to it* selects. */
  rootKey: string;
  output: AnswerOutput;
  adding?: Adding;
  onDrawing: OnDrawing;
  t: AnswerCardTranslations;
}) {
  const { table, identities, output, adding, onDrawing, t } = props;
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

  const drawing = stats.error === null && (!readable || !narrowed);
  React.useLayoutEffect(() => onDrawing(drawing), [drawing, onDrawing]);

  if (stats.error !== null) return <Failure error={stats.error} t={t} />;
  if (!readable || !narrowed) return <Skeleton className="h-[220px] w-full" slot="answer-card-pending" />;
  const tile = output.answer.show;
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1" data-slot="answer-card-actions">
        <FilterToIt identity={props.rootKey} output={output} fields={readable.fields} t={t} table={table} />
        {adding && <AddToDashboard {...adding} fields={readable.fields} relationKey={props.dashboardKey} output={output} t={t} />}
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
      <PageFilter output={output} t={t} />
    </>
  );
}

/**
 * What of the page's filter the answer was read under, and what its relation could not answer — as
 * the model was told. It is the read's, when it ran: the tile above follows the page afterwards.
 * Nothing when the page had no filter.
 */
function PageFilter({ output, t }: { output: AnswerOutput; t: AnswerCardTranslations }) {
  const { under, skipped } = output;
  if (under.length === 0 && skipped.length === 0) return null;
  const said = [under.length > 0 && `${t.under} ${under.join("; ")}.`, skipped.length > 0 && `${t.skipped} ${skippedText(skipped)}.`];
  return (
    <p className="text-muted-foreground text-xs" data-slot="answer-card-filter">
      {said.filter(Boolean).join(" ")}
    </p>
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

/**
 * The tile goes on under the answer's own id — the call's — so whether the relation's spec holds it
 * is a lookup in what the host hands back, not a flag this card keeps and a remount loses. The host's
 * write is what confirms it: while a promise it returned is pending the button says so, whatever the
 * spec already shows, and a rejection is drawn under the actions with the button back.
 */
function AddToDashboard(props: Adding & {
  relationKey: string;
  output: AnswerOutput;
  fields: readonly FieldStat[];
  t: AnswerCardTranslations;
}) {
  const { dashboards, onAdd, copy, relationKey: key, output, fields, t } = props;
  const [write, setWrite] = React.useState<{ status: "idle" } | { status: "pending" } | { status: "failed"; error: unknown }>({ status: "idle" });
  const tile = output.answer.show;
  const added = dashboards.byRelation[key]?.tiles.some((each) => each.id === tile.id) ?? false;
  const pending = write.status === "pending";
  const add = () => {
    const current = dashboards.byRelation[key] ?? autoDashboard(fields);
    const next = { ...dashboards, byRelation: { ...dashboards.byRelation, [key]: { ...current, tiles: [...current.tiles, tile] } } };
    let written: void | Promise<unknown>;
    try {
      written = onAdd(next, { relation: output.answer.relation, key });
    } catch (error) {
      return setWrite({ status: "failed", error });
    }
    if (typeof (written as PromiseLike<unknown> | undefined)?.then !== "function") return setWrite({ status: "idle" });
    setWrite({ status: "pending" });
    (written as PromiseLike<unknown>).then(
      () => setWrite({ status: "idle" }),
      (error: unknown) => setWrite({ status: "failed", error }),
    );
  };
  return (
    <>
      <Button disabled={added || pending} isLoading={pending} onClick={add} size="sm" variant="ghost">
        <LayoutDashboardIcon />
        {pending ? t.adding : added ? t.added : t.add}
      </Button>
      {write.status === "failed" && (
        <DiagnosticList className="basis-full">
          <Problem copy={copy} error={write.error} />
        </DiagnosticList>
      )}
    </>
  );
}
