"use client";

import { ark } from "@ark-ui/react/factory";
import { PostgreSQL, sql as sqlLanguage } from "@codemirror/lang-sql";
import { literal, sql, type TableExpr } from "@kanzo-tech/mosaic";
import type { ToolPart } from "../tool.js";
import { CodeIcon, DownloadIcon } from "lucide-react";
import * as React from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Clipboard,
  ClipboardTrigger,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  DownloadTrigger,
  Skeleton,
  StatLabel,
  StatRoot,
  StatValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@kanzo-tech/ui";
import {
  bin,
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartDot,
  ChartLineY,
  ChartRectY,
  ChartRegressionY,
  ChartRoot,
  count,
  type ChartTile,
  type FieldStat,
  plotRelation,
  recommend,
  sum,
  useFieldStats,
} from "@kanzo-tech/ui/analytics";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import {
  type ColumnDef,
  DataTableContent,
  DataTablePagination,
  DataTableRoot,
  useDataTable,
} from "@kanzo-tech/ui/table";
import type { QueryAnswer, QueryOutput, QueryRow } from "./agent.js";

/** Every word `QueryResult` draws. English by default. */
export interface QueryResultTranslations {
  /** What the answer holds, above it. `truncated` is the row cap cutting it short. */
  rows: (count: number, truncated: boolean) => string;
  copy: string;
  csv: string;
  sql: string;
  chart: string;
  table: string;
  /** Over the refusal's words, when the statement gate or the engine refused the statement. */
  failed: string;
  /** In place of a table with no rows. */
  empty: string;
}

const ENGLISH: QueryResultTranslations = {
  rows: (n, truncated) => `${truncated ? "The first " : ""}${n.toLocaleString()} ${n === 1 ? "row" : "rows"}`,
  copy: "Copy the SQL",
  csv: "Download as CSV",
  sql: "SQL",
  chart: "Chart",
  table: "Table",
  failed: "The query failed",
  empty: "No rows",
};

export interface QueryResultProps extends Omit<React.ComponentProps<typeof ark.div>, "children" | "part"> {
  /** The `query` call, as `Chat`'s `tools` hands it over. */
  part: ToolPart;
  /**
   * What the host does with the answer, beside Copy and CSV — show these on a canvas, filter the
   * page to these. Given the whole answer; draws buttons.
   */
  actions?: (output: QueryOutput) => React.ReactNode;
  translations?: Partial<QueryResultTranslations>;
}

/**
 * A `dataAgent` answer, drawn as what it is — Genie's and Hex's result card. One figure is a `Stat`;
 * rows a chart suits are the chart `recommend` proposes for them as an answer, with the table a
 * toggle away; anything else is a compact table. The SQL is under it, read-only and folded away,
 * and the actions are above: the SQL to the clipboard, the rows as CSV, and the host's own.
 *
 * Everything it draws is the rows the answer holds — Hex's and Genie's cards draw the result set, not
 * the query. The SQL is never run again: a transcript is kept and restored, and a statement read out
 * of one is no one's to run. The chart reads those rows as a relation of literals (`answerRelation`),
 * and it is **not** a client of the page's crossfilter: an answer is what was true when it was asked,
 * and the page filtering it again would be answering a question nobody asked. Taking an answer back
 * to the page is an action the host draws.
 */
export function QueryResult(props: QueryResultProps) {
  const { part, actions, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  if (part.state !== "output-available") return null;
  const answer = part.output as QueryAnswer;

  return (
    <ark.div className={cn("flex min-w-0 flex-col gap-3", className)} {...rest} data-slot={slot ?? "query-result"}>
      {"error" in answer ? (
        <Alert variant="destructive">
          <AlertTitle>{t.failed}</AlertTitle>
          <AlertDescription className="font-mono text-xs">{answer.error.message}</AlertDescription>
        </Alert>
      ) : (
        <Answer actions={actions} output={answer} t={t} />
      )}
      <Collapsible slot="query-result-sql">
        <CollapsibleTrigger
          className={cn(
            "-ms-1.5 inline-flex min-h-[24px] w-fit items-center gap-1.5 rounded-md px-1.5 py-1",
            "text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground",
            "motion-reduce:transition-none! [&_svg:not([class*='size-'])]:size-3.5",
          )}
        >
          <CodeIcon />
          <span className="font-medium">{t.sql}</span>
          <CollapsibleIndicator className="opacity-64" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <CodeEditor extensions={SQL} lineNumbers={false} maxHeight="16rem" readOnly value={answer.sql} />
        </CollapsibleContent>
      </Collapsible>
    </ark.div>
  );
}

/** Read once: the extension's identity is what the editor reconfigures on. */
const SQL = sqlLanguage({ dialect: PostgreSQL });

/** How an answer is best read: one figure, a chart over its rows, or the rows themselves. */
export type AnswerView = { kind: "stat"; label: string; value: unknown } | { kind: "rows" };

/** The columns of an answer, in its own order. */
const columnsOf = (rows: readonly QueryRow[]) => Object.keys(rows[0] ?? {});

/** One row of one column is a figure; anything else is rows, for `answerChart` to look at. */
export function answerView(rows: readonly QueryRow[]): AnswerView {
  const columns = columnsOf(rows);
  if (rows.length === 1 && columns.length === 1) return { kind: "stat", label: columns[0]!, value: rows[0]![columns[0]!] };
  return { kind: "rows" };
}

/** A band chart past this many bars is a list nobody can read; it is a table instead. */
const BARS = 40;

/** The chart `recommend` proposes for an answer's fields, among those drawn here — or `null`. */
export function answerChart(fields: readonly FieldStat[]): ChartTile | null {
  const drawable = (spec: ChartTile) => {
    if (spec.type === "bar") return (fields.find((f) => f.name === spec.x)?.distinct ?? Infinity) <= BARS;
    return spec.type === "line" || spec.type === "histogram" || spec.type === "regression";
  };
  return recommend(fields, "answer").find((r) => drawable(r.spec))?.spec ?? null;
}

/** RFC 4180: a field with a comma, a quote or a line break is quoted, and its quotes doubled. */
export function toCsv(rows: readonly QueryRow[]): string {
  const columns = columnsOf(rows);
  const field = (value: unknown) => {
    const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns, ...rows.map((row) => columns.map((c) => row[c]))].map((line) => line.map(field).join(",")).join("\r\n");
}

/** A timestamp as the agent writes one into a message: `Date.prototype.toISOString`. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A value of a kept row, as the literal it was: a timestamp a `Date` again, a list or struct its JSON. */
const revive = (value: unknown) =>
  typeof value === "string" ? (ISO.test(value) ? new Date(value) : value) : value !== null && typeof value === "object" ? JSON.stringify(value) : value;

/**
 * An answer's rows as a relation: `VALUES` of mosaic-sql literals under the answer's own column
 * names. What the chart reads, so it draws the rows the card holds and nothing else — the values are
 * literals and the names identifiers, quoted, so no text of a transcript reaches the engine as SQL.
 */
export function answerRelation(rows: readonly QueryRow[]): TableExpr {
  const columns = columnsOf(rows);
  const tuples = rows.map((row) => `(${columns.map((column) => String(literal(revive(row[column])))).join(", ")})`);
  const names = columns.map((column) => `"${column.replaceAll('"', '""')}"`);
  return sql`(SELECT * FROM (VALUES ${tuples.join(", ")}) AS "answer"(${names.join(", ")}))`;
}

const format = (value: unknown) =>
  typeof value === "number" ? value.toLocaleString() : value == null ? "—" : String(value);

function Answer(props: { output: QueryOutput; actions?: (output: QueryOutput) => React.ReactNode; t: QueryResultTranslations }) {
  const { output, actions, t } = props;
  const view = answerView(output.rows);
  const [chosen, setChosen] = React.useState<"chart" | "table">("chart");

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1" data-slot="query-result-toolbar">
        <span className="me-auto text-muted-foreground text-xs tabular-nums">{t.rows(output.rows.length, output.truncated)}</span>
        <Clipboard value={output.sql}>
          <ClipboardTrigger aria-label={t.copy} />
        </Clipboard>
        <DownloadTrigger asChild data={() => toCsv(output.rows)} fileName="answer.csv" mimeType="text/csv">
          <Button aria-label={t.csv} size="icon-sm" variant="ghost">
            <DownloadIcon />
          </Button>
        </DownloadTrigger>
        {actions?.(output)}
      </div>
      {view.kind === "stat" ? (
        <StatRoot className="w-fit min-w-40">
          <StatLabel>{view.label}</StatLabel>
          <StatValue>{format(view.value)}</StatValue>
        </StatRoot>
      ) : output.rows.length === 0 ? (
        <ResultTable empty={t.empty} rows={output.rows} />
      ) : (
        <Rows chosen={chosen} onChoose={setChosen} output={output} t={t} />
      )}
    </>
  );
}

/** The answer's rows: summarised once, then drawn as the chart they call for, or as a table. */
function Rows(props: {
  output: QueryOutput;
  chosen: "chart" | "table";
  onChoose: (view: "chart" | "table") => void;
  t: QueryResultTranslations;
}) {
  const { output, chosen, onChoose, t } = props;
  // A re-render that builds a new node names the same relation: `useFieldStats` keys on its SQL.
  const relation = React.useMemo(() => answerRelation(output.rows), [output.rows]);
  const stats = useFieldStats(relation);
  if (stats.fields === null && stats.error === null) return <Skeleton className="h-[220px] w-full" />;
  const plotted = stats.fields && stats.columns ? plotRelation(relation, { fields: stats.fields, columns: stats.columns }) : null;
  const card = plotted ? answerChart(plotted.fields) : null;
  if (!plotted || !card) return <ResultTable empty={t.empty} rows={output.rows} />;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Single-select and never empty: two readings of one answer. */}
      <ToggleGroup
        aria-label={`${t.chart} / ${t.table}`}
        multiple={false}
        onValueChange={(details) => {
          const next = details.value[0] as "chart" | "table" | undefined;
          if (next) onChoose(next);
        }}
        size="sm"
        value={[chosen]}
        variant="outline"
      >
        <ToggleGroupItem value="chart">{t.chart}</ToggleGroupItem>
        <ToggleGroupItem value="table">{t.table}</ToggleGroupItem>
      </ToggleGroup>
      {chosen === "chart" ? (
        <AnswerChart card={card} fields={plotted.fields} rows={output.rows} table={plotted.table} />
      ) : (
        <ResultTable empty={t.empty} rows={output.rows} />
      )}
    </div>
  );
}

const HEIGHT = 220;
const ACCENT = "var(--chart-1)";
const truncate = (text: unknown) => {
  const s = String(text);
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
};

/**
 * One recommended card, drawn without an interactor and unfiltered (`filterBy={null}`): the marks
 * `ChartCard` draws for the same spec, minus the half that makes a dashboard tile a crossfilter
 * client.
 */
function AnswerChart(props: { table: TableExpr; fields: readonly FieldStat[]; card: ChartTile; rows: readonly QueryRow[] }) {
  const { table, fields, card, rows } = props;
  const y = card.y.op === "count" ? count() : card.y.op === "sum" ? sum(card.y.field ?? "") : card.y.field;
  const frame = { table, filterBy: null, height: HEIGHT, margin: { top: 8, right: 12, bottom: 24, left: 44 } };

  switch (card.type) {
    case "bar": {
      const longest = Math.max(0, ...rows.map((row) => truncate(row[card.x]).length));
      return (
        <ChartRoot {...frame} margin={{ top: 4, right: 12, bottom: 24, left: Math.min(140, Math.max(40, 12 + 6.5 * longest)) }}>
          <ChartBarX fill={ACCENT} insetBottom={1} sort={{ y: "-x" }} tip x={y} y={card.x} />
          <ChartAxisX grid label={null} ticks={5} />
          <ChartAxisY label={null} tickFormat={truncate} />
        </ChartRoot>
      );
    }
    case "line": {
      const field = fields.find((f) => f.name === card.x);
      const x = field?.kind === "temporal" && field.distinct > 60 ? bin(card.x) : card.x;
      return (
        <ChartRoot {...frame}>
          <ChartLineY stroke={ACCENT} strokeWidth={1.5} tip x={x} y={y} />
          <ChartAxisX label={null} ticks={8} />
          <ChartAxisY grid label={null} />
        </ChartRoot>
      );
    }
    case "histogram":
      return (
        <ChartRoot {...frame}>
          <ChartRectY fill={ACCENT} inset={0.5} x={bin(card.x)} y={y} />
          <ChartAxisX label={null} ticks={8} />
          <ChartAxisY grid label={null} />
        </ChartRoot>
      );
    default:
      return (
        <ChartRoot {...frame} margin={{ top: 8, right: 12, bottom: 32, left: 48 }}>
          <ChartDot fill={ACCENT} fillOpacity={0.35} r={2} tip x={card.x} y={card.y.field} />
          <ChartRegressionY ci={0.95} fill={ACCENT} stroke={ACCENT} x={card.x} y={card.y.field} />
          <ChartAxisX label={card.x} ticks={8} />
          <ChartAxisY grid label={card.y.field ?? null} />
        </ChartRoot>
      );
  }
}

/** The rows, a page at a time: the columns are the first row's. */
function ResultTable(props: { rows: readonly QueryRow[]; empty: React.ReactNode }) {
  const { rows, empty } = props;
  const columns = React.useMemo<ColumnDef<QueryRow>[]>(
    () =>
      columnsOf(rows).map((key) => ({
        id: key,
        header: key,
        accessorFn: (row: QueryRow) => row[key],
        cell: ({ row }) => {
          const value = row.original[key];
          if (value == null) return <span className="text-muted-foreground">null</span>;
          // Not `format`: a table column of ids or years reads wrong with a thousands separator.
          return <span className={typeof value === "number" ? "tabular-nums" : undefined}>{String(value)}</span>;
        },
      })),
    [rows],
  );
  const table = useDataTable({ columns, data: rows as QueryRow[], pageSize: 8 });
  return (
    <DataTableRoot className="gap-2 text-xs" table={table}>
      <DataTableContent empty={empty} />
      {rows.length > 8 && <DataTablePagination />}
    </DataTableRoot>
  );
}
