"use client";

import { ark } from "@ark-ui/react/factory";
import {
  clauseLabel,
  clausePoints,
  clauseSemiJoin,
  JoinResolver,
  Query,
  relationKey,
  relationQuery,
  type JoinGraph,
  type Relation,
  type SelectionClause,
  type TableExpr,
} from "@kanzo-tech/mosaic";
import { CheckIcon, LayoutDashboardIcon, ListFilterIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import * as React from "react";
import {
  Button,
  cn,
  DiagnosticList,
  Problem,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ProblemProps,
} from "@kanzo-tech/ui";
import {
  autoDashboard,
  MosaicClients,
  plotRelation,
  TileView,
  tileQuery,
  useClauses,
  useMosaic,
  type Condition,
  type Dashboards,
  type FieldStat,
} from "@kanzo-tech/ui/analytics";
import type { AnswerOutput } from "./read.js";
import { unansweredText } from "./answer.js";
import { answerRelation, resolverOf } from "./ask.js";

/** Every word `AnswerCard` draws. English by default. */
export interface AnswerCardTranslations {
  /** Narrows the page to the answer's rows: the button's name and its tooltip. It is pressed while the page is narrowed to them. */
  filter: string;
  /** Why *filter* is disabled: the answer's clause would keep every row the page already keeps. */
  keeps: string;
  /** What a chip of the page's filter calls the answer's clause, before what the clause filters. */
  label: string;
  add: string;
  /** The same button while the host writes the tile. */
  adding: string;
  /** The same button, disabled, once the tile is on the dashboard and the host gave no `onOpen`. */
  added: string;
  /** In its place once the tile is on the dashboard, given `onOpen`: to the dashboard, showing the tile. */
  open: string;
  /** The failure's title, over its words. */
  failed: string;
  /** Before the page's clauses the answer was read under. */
  under: string;
  /** Before the page's clauses its relation cannot answer, which keep none of its rows, each with the fields it lacks. */
  unanswered: string;
  /** The caption of the rows the answer was read from: its tile's data, as a table assistive technology reads. */
  data: string;
  /** After that caption when the cap cut the rows short. */
  truncated: string;
}

const ENGLISH: AnswerCardTranslations = {
  filter: "Filter the page to these rows",
  keeps: "This answer keeps everything in view",
  label: "Ask",
  add: "Add to the dashboard",
  adding: "Adding to the dashboard…",
  added: "On the dashboard",
  open: "Open on the dashboard",
  failed: "The answer failed",
  under: "Read under the page's filter:",
  unanswered: "Keeps none of this relation's rows, which lack the fields they filter:",
  data: "The rows the answer was read from",
  truncated: "the first, cut short by the cap",
};

export type AnswerCardProps = Omit<React.ComponentProps<typeof ark.div>, "children"> & {
  /** The answer, as a `data-answer` part holds it — `Chat`'s `data` renderers hand it over — read or still being read. */
  answer: AnswerOutput;
  /** The read will never land: the reader pressed Stop, or a kept transcript was cut mid-read. */
  stopped?: boolean;
  /** The join graph the agent was given: the answer's relation is compiled over it. */
  graph: JoinGraph;
  /** The host's words for a coded failure, as `Problem` takes them. */
  describe?: ProblemProps["describe"];
  translations?: Partial<AnswerCardTranslations>;
} & AnswerCardAdding;

/**
 * *Add to the dashboard*: both or neither, and *Open on the dashboard* only with them. The next
 * document is built from `dashboards`, so a write without it would replace every other relation's
 * spec with nothing.
 */
type AnswerCardAdding =
  | { dashboards?: never; onAdd?: never; onOpen?: never }
  | {
      /**
       * The host's saved dashboards, a spec per relation, as it draws them: the tile is on the
       * dashboard while its relation's spec holds it, so a remount still says so, and a removal saved
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
      /**
       * Makes *Open on the dashboard* the action once the tile is there: the host switches to its
       * dashboard view of `added.relation` and brings `added.id` into view. Without it, the button
       * says *On the dashboard*, disabled.
       */
      onOpen?: (added: AnswerAdded) => void;
    };

/** Where *Add to the dashboard* put the tile. */
export interface AnswerAdded {
  /** The answer's relation, as the model named it: what a host's dashboard view is driven by. */
  relation: Relation;
  /** `relationKey(graph, relation)`: what a host keeps its dashboards by. */
  key: string;
  /** The tile's id in that relation's spec — the answer's: what a host brings into view. */
  id: string;
}

/**
 * **An Ask answer, drawn as the dashboard tile it is**: `ChartCard`, `DashboardStat` or a
 * `DetailTable`, over the answer's relation narrowed by its conditions, under the page's crossfilter
 * like every tile — what the reader filters afterwards, the card follows. Nothing in it is SQL a
 * transcript carried: a kept answer is names, compiled again over the host's graph.
 *
 * Two verbs fall out of the shape, icon buttons in the tile's header. **Filter the page to these
 * rows** narrows the page to the answer — its conditions, and the categories its bars answered — as
 * one semi-join on the relation's root key, so the graph and every relation keyed the same way
 * follow; it is disabled when that would keep everything the page keeps. **Add to the dashboard**
 * hands the host its dashboards with the tile in the relation's spec, reads whether it is there off
 * what the host hands back, and once it is, opens it there when the host says how.
 *
 * The card is `aria-busy` while the engine reads the answer, over a skeleton the chart's height, and
 * draws nothing of the tile when the read stopped before it landed. A failure to draw it — a relation
 * the host's graph no longer has — is a `Problem`.
 */
export function AnswerCard(props: AnswerCardProps) {
  const { answer, stopped = false, graph, dashboards, onAdd, onOpen, describe, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const output = answer.rows === undefined ? null : answer;
  // Busy until the rows land: the tile draws from them and the graph's facts at once, with nothing
  // more to read.
  const running = !stopped && output === null;

  return (
    <ark.div
      aria-busy={running || undefined}
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "answer-card"}
    >
      {output && (
        <Answered
          adding={onAdd && dashboards && { dashboards, onAdd, onOpen, describe }}
          graph={graph}
          output={output as Required<AnswerOutput>}
          t={t}
        />
      )}
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
function Answered(props: { graph: JoinGraph; output: Required<AnswerOutput>; adding?: Adding; t: AnswerCardTranslations }) {
  const { graph, output, t } = props;
  const relation = output.answer.relation;
  // The page's resolver, as every tile reads through it; the graph's own where there is no page over it.
  const { selection } = useMosaic();
  const resolver = selection.resolver instanceof JoinResolver && selection.resolver.joins === graph ? selection.resolver : resolverOf(graph);
  const compiled = React.useMemo(() => {
    try {
      return { table: relationQuery(graph, relation), dashboardKey: relationKey(graph, relation), resolver, keys: resolver.steps(relation).map((s) => s.key) };
    } catch (error) {
      return { error };
    }
  }, [graph, relation, resolver]);
  if ("error" in compiled) return <Failure error={compiled.error} t={t} />;
  return <Drawn {...props} {...compiled} />;
}

/** What *Add to the dashboard* reads and writes: the host's document, its write, where it opens, and its words for a failure. */
interface Adding {
  dashboards: Dashboards;
  onAdd: (next: Dashboards, added: AnswerAdded) => void | Promise<unknown>;
  onOpen?: (added: AnswerAdded) => void;
  describe?: ProblemProps["describe"];
}

function Drawn(props: {
  table: TableExpr;
  graph: JoinGraph;
  /** The relation's key: what a host keeps its dashboards by. Not `key`, which React keeps for itself. */
  dashboardKey: string;
  /** The relation's steps' keys, the root's first: what a dashboard over it leaves out of its fields, and what *Filter the page to these rows* selects. */
  keys: string[];
  resolver: JoinResolver;
  output: Required<AnswerOutput>;
  adding?: Adding;
  t: AnswerCardTranslations;
}) {
  const { table, graph, keys, resolver, output, adding, t } = props;
  // The fields the answer was asked over, as the graph describes them — what the model was told, and
  // what a dashboard over the relation reads, so the tile it is added to is drawn the same. Nothing
  // is read for them.
  const readable = React.useMemo(() => {
    const about = answerRelation(output.answer.relation, graph);
    return plotRelation(table, { fields: about.fields, columns: about.columns });
  }, [table, graph, output.answer.relation]);
  const write = useAdd(adding, props.dashboardKey, output);

  const tile = output.answer.tile;
  // The tile's own header holds them, beside its title, as a dashboard tile's pencil is held.
  const actions = (
    <>
      <FilterToRows fields={readable.fields} identity={keys[0]!} output={output} resolver={resolver} t={t} table={readable.table} />
      {write && <AddToDashboard fields={readable.fields} t={t} write={write} />}
    </>
  );
  return (
    <>
      {/* The tile reads the answer's relation, narrowed by its own question, and is a client of it: what the page crosses into. */}
      <MosaicClients relation={output.answer.relation}>
        <TileView actions={actions} fields={readable.fields} relation={readable.table} tile={tile} />
      </MosaicClients>
      {write?.status.state === "failed" && (
        <DiagnosticList>
          <Problem describe={adding?.describe} error={write.status.error} />
        </DiagnosticList>
      )}
      <AnswerData output={output} t={t} />
      <PageFilter output={output} t={t} />
    </>
  );
}

/**
 * **One verb of the tile, as an icon with its name in a tooltip** — the pencil's shape, a ghost icon
 * button in the header. `hint` is why it is disabled: its description, and the tooltip in its name's
 * place. A disabled button takes no pointer, so what holds it is the tooltip's trigger.
 */
function TileAction(props: React.ComponentProps<typeof Button> & { label: string; hint?: string }) {
  const { label, hint, children, ...rest } = props;
  const described = React.useId();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            aria-describedby={hint ? described : undefined}
            aria-label={label}
            className="text-muted-foreground hover:text-foreground focus-visible:text-foreground aria-pressed:text-foreground"
            size="icon-sm"
            variant="ghost"
            {...rest}
          >
            {children}
          </Button>
          {hint && (
            <span className="sr-only" id={described}>
              {hint}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint ?? label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * **The rows the answer was read from, as a table** — its tile's data for whoever cannot see the
 * chart, after the W3C WAI Images Tutorial's *Complex Images*: a chart's long description is its data,
 * best structured as a table on the same page. It is visually hidden, as Highcharts' accessibility
 * module keeps its screen-reader data table, and holds the read's rows as it returned them — what the
 * engine answered under the page's filter when the call ran, which the tile above, following the page
 * afterwards, may no longer show. Nothing when the read returned no rows.
 */
function AnswerData({ output, t }: { output: Required<AnswerOutput>; t: AnswerCardTranslations }) {
  const columns = Object.keys(output.rows[0] ?? {});
  if (columns.length === 0) return null;
  return (
    <table className="sr-only" data-slot="answer-card-data">
      <caption>{output.truncated ? `${t.data}, ${t.truncated}` : t.data}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {output.rows.map((row, i) => (
          <tr key={i}>
            {columns.map((column) => (
              <td key={column}>{row[column] === null || row[column] === undefined ? "" : String(row[column])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * What of the page's filter the answer was read under, and what its relation could not answer — as
 * the model was told. It is the read's, when it ran: the tile above follows the page afterwards.
 * Nothing when the page had no filter.
 */
function PageFilter({ output, t }: { output: Required<AnswerOutput>; t: AnswerCardTranslations }) {
  const { under, unanswered } = output;
  if (under.length === 0 && unanswered.length === 0) return null;
  const said = [under.length > 0 && `${t.under} ${under.join("; ")}.`, unanswered.length > 0 && `${t.unanswered} ${unansweredText(unanswered)}.`];
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
function domainClause(output: Required<AnswerOutput>, fields: readonly FieldStat[], source: object): SelectionClause | null {
  const show = output.answer.tile;
  if (show.kind !== "chart" || show.type !== "bar" || output.truncated) return null;
  if (fields.find((f) => f.name === show.x)?.kind !== "categorical") return null;
  const values = [...new Set(output.rows.map((row) => row[show.x]))];
  return clausePoints([show.x], values.map((v) => [v]), { source });
}

/**
 * **Whether the answer's clause keeps every row of its relation** — what makes *Filter the page to
 * these rows* a no-op. True when the answer has no conditions, its relation is a type alone (a hop
 * keeps only the roots that have one), and its bars answered every category of their column: none
 * missing against the field's `distinct`, and none of them null, which the clause would drop. It
 * reads what the card already holds, so it costs no query. `distinct` is DuckDB's `approx_unique`,
 * exact at the few dozen values a bar chart answers; and it counts the whole relation, so an answer
 * read under a page that already narrowed the column is not caught, and stays enabled.
 */
function keepsEverything(output: Required<AnswerOutput>, fields: readonly FieldStat[]): boolean {
  const { tile: show, relation } = output.answer;
  if ((show.where ?? []).length > 0 || ("top" in show && show.top !== undefined) || relation.path.length > 0) return false;
  if (show.kind !== "chart" || !domainClause(output, fields, {})) return false;
  const values = new Set(output.rows.map((row) => row[show.x]));
  const field = fields.find((f) => f.name === show.x)!;
  return !values.has(null) && !values.has(undefined) && values.size >= field.distinct;
}

/**
 * The answer's conditions and its bars' categories, published to the page as one semi-join on the
 * relation's root key: a column clause would filter only what has the relation's columns, and the
 * key is what the page shares. Its chip names what it filters — *Ask: gender female* — each
 * clause read as the filter bar reads one. Pressed again, it takes the clause back. Disabled when it
 * would keep everything in view.
 */
function FilterToRows(props: {
  table: TableExpr;
  identity: string;
  resolver: JoinResolver;
  output: Required<AnswerOutput>;
  fields: readonly FieldStat[];
  t: AnswerCardTranslations;
}) {
  const { table, identity, resolver, output, fields, t } = props;
  const { selection } = useMosaic();
  // Its own source, so its chip retracts it and nothing else.
  const [source] = React.useState(() => ({ reset() {} }));
  const held = useClauses(selection).some((clause) => clause.source === source);
  const { tile, relation } = output.answer;
  const domain = domainClause(output, fields, source);
  const where = tile.where ?? [];
  const ranked = "top" in tile && tile.top !== undefined;
  if (where.length === 0 && !domain && !ranked) return null;
  const said = [...where.map(conditionWords), ...(domain ? [clauseLabel(domain)] : [])];
  const label = `${t.label}: ${said.join("; ")}`;
  const idle = !held && keepsEverything(output, fields);
  const publish = () => {
    // The rows the tile reads — its own question, compiled once, as the chart and the rows are.
    const compiled = tileQuery(table, tile, { fields, relation, resolver });
    if ("missing" in compiled) return;
    const members = Query.select(identity).from(compiled.table).where(domain ? [domain.predicate!] : []);
    selection.update(clauseSemiJoin(identity, members, { source, label }));
  };
  return (
    <TileAction
      aria-pressed={held}
      disabled={idle}
      hint={idle ? t.keeps : undefined}
      label={t.filter}
      onClick={() => (held ? selection.update(clauseSemiJoin(identity, null, { source })) : publish())}
    >
      <ListFilterIcon />
    </TileAction>
  );
}

/** A tile's condition, as a chip reads one: its path, then what it keeps. */
const conditionWords = (c: Condition) =>
  "in" in c ? `${c.field} ${c.in.join(", ")}` : "between" in c ? `${c.field} ${c.between.join("–")}` : `${c.field} ~ ${c.contains}`;

type WriteStatus = { state: "idle" } | { state: "pending" } | { state: "failed"; error: unknown };

/**
 * The tile goes on under the answer's own id — the call's — so whether the relation's spec holds it
 * is a lookup in what the host hands back, not a flag this card keeps and a remount loses. The host's
 * write is what confirms it: while a promise it returned is pending the button says so, whatever the
 * spec already shows, and a rejection is drawn under the tile with the button back. Here rather than
 * in the button, since the button is in the tile's header and the failure is not.
 */
function useAdd(adding: Adding | undefined, key: string, output: Required<AnswerOutput>) {
  const [status, setStatus] = React.useState<WriteStatus>({ state: "idle" });
  if (!adding) return null;
  const { dashboards, onAdd, onOpen } = adding;
  const tile = output.answer.tile;
  const where: AnswerAdded = { relation: output.answer.relation, key, id: tile.id };
  const added = dashboards.byRelation[key]?.tiles.some((each) => each.id === tile.id) ?? false;
  const add = (fields: readonly FieldStat[]) => {
    const current = dashboards.byRelation[key] ?? autoDashboard(fields);
    const next = { ...dashboards, byRelation: { ...dashboards.byRelation, [key]: { ...current, tiles: [...current.tiles, tile] } } };
    let written: void | Promise<unknown>;
    try {
      written = onAdd(next, where);
    } catch (error) {
      return setStatus({ state: "failed", error });
    }
    if (typeof (written as PromiseLike<unknown> | undefined)?.then !== "function") return setStatus({ state: "idle" });
    setStatus({ state: "pending" });
    (written as PromiseLike<unknown>).then(
      () => setStatus({ state: "idle" }),
      (error: unknown) => setStatus({ state: "failed", error }),
    );
  };
  return { status, added, add, open: onOpen && (() => onOpen(where)) };
}

/** *Add to the dashboard*; once it is there, *Open on the dashboard* when the host says how, and *On the dashboard* when not. */
function AddToDashboard(props: { write: NonNullable<ReturnType<typeof useAdd>>; fields: readonly FieldStat[]; t: AnswerCardTranslations }) {
  const { write, fields, t } = props;
  const pending = write.status.state === "pending";
  if (write.added && !pending) {
    return write.open ? (
      <TileAction label={t.open} onClick={write.open}>
        <SquareArrowOutUpRightIcon />
      </TileAction>
    ) : (
      <TileAction disabled label={t.added}>
        <CheckIcon />
      </TileAction>
    );
  }
  return (
    <TileAction disabled={pending} isLoading={pending} label={pending ? t.adding : t.add} onClick={() => write.add(fields)}>
      <LayoutDashboardIcon />
    </TileAction>
  );
}
