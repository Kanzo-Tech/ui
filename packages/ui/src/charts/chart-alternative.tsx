import { isAggregateExpression } from "@kanzo-tech/mosaic";
import type { ChartConfig } from "./chart-config.js";

/**
 * Past this many rows a chart's text alternative is a summary, not a table: a table of 4,000 bars is
 * not one anyone reads. A decision, not a measurement (`/docs/design/analytics`).
 */
export const ALT_ROWS = 50;

/** What a vgplot mark holds once its query has answered, as far as the alternative reads it. */
export interface AlternativeMark {
  readonly channels: readonly { readonly channel: string; readonly field?: unknown; readonly as?: unknown }[];
  readonly data?: { readonly numRows: number; readonly columns: Readonly<Record<string, ArrayLike<unknown>>> };
  /** `null` for the unfiltered context layer under a crossfilter pair. */
  readonly filterBy?: unknown;
}

/** One table of what a chart drew: its columns, and a row per mark, as the values the marks hold. */
export interface Alternative {
  /** How many leading columns are the key of a row; the rest are values. */
  readonly keys: number;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
}

/** Channels that carry no value a reader would want in a table. */
const NOT_A_VALUE = new Set(["tip", "sort", "title"]);

const label = (config: ChartConfig, name: string): string => {
  const given = config[name]?.label;
  return typeof given === "string" ? given : name;
};

interface Layer {
  readonly name: string;
  readonly context: boolean;
  readonly rows: Map<string, unknown>;
}

/**
 * **What a chart drew, as rows**, from the answers its marks already hold, with no second query. A
 * mark's non-aggregate fields are the key of a row and its aggregates are the values; marks over the
 * same key — the kept layer over the unfiltered context layer of a crossfiltered chart — are columns
 * of one table, so what is in colour and what is greyed is a number, not a shade.
 */
export function readAlternatives(marks: readonly AlternativeMark[], config: ChartConfig = {}): Alternative[] {
  const groups = new Map<string, { keys: string[]; cells: Map<string, unknown[]>; layers: Layer[] }>();
  for (const mark of marks) {
    const { data } = mark;
    if (!data || data.numRows === 0) continue;
    const named = mark.channels.filter(
      (c) => c.field !== undefined && !NOT_A_VALUE.has(c.channel) && typeof c.as === "string" && data.columns[c.as] !== undefined,
    ) as { field: unknown; as: string }[];
    const keys = [...new Set(named.filter((c) => !isAggregateExpression(c.field as never)).map((c) => c.as))];
    const values = [...new Set(named.filter((c) => isAggregateExpression(c.field as never)).map((c) => c.as))];
    if (keys.length + values.length === 0) continue;
    const id = keys.join("\0");
    const group = groups.get(id) ?? groups.set(id, { keys, cells: new Map(), layers: [] }).get(id)!;
    const context = mark.filterBy === null || mark.filterBy === undefined;
    const drawn = new Map<string, unknown>();
    for (let i = 0; i < data.numRows; i++) {
      const cells = keys.map((k) => data.columns[k]![i]);
      const key = JSON.stringify(cells.map(String));
      if (!group.cells.has(key)) group.cells.set(key, cells);
      drawn.set(key, i);
    }
    for (const name of values) {
      if (group.layers.some((l) => l.name === name && l.context === context)) continue;
      group.layers.push({ name, context, rows: new Map([...drawn].map(([key, i]) => [key, data.columns[name]![i as number]])) });
    }
  }
  return [...groups.values()].map(({ keys, cells, layers }) => ({
    keys: keys.length,
    columns: [
      ...keys.map((k) => label(config, k)),
      ...layers.map((l) => (l.context && layers.some((o) => o.name === l.name && !o.context) ? `${label(config, l.name)} (all rows)` : label(config, l.name))),
    ],
    rows: [...cells].map(([key, row]) => [...row, ...layers.map((l) => l.rows.get(key))]),
  }));
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "bigint") return new Intl.NumberFormat().format(value);
  return String(value);
}

/**
 * **A chart's text alternative**: a `table` with the chart's title for its caption, or, past
 * {@link ALT_ROWS}, a summary of how many marks there are and the largest and smallest by label.
 * Visually hidden and read by a screen reader in place of the picture, which is `aria-hidden`.
 */
export function ChartAlternative({ title, tables }: { title?: string; tables: readonly Alternative[] }) {
  if (tables.length === 0) return null;
  return (
    <div className="sr-only" data-slot="chart-alternative">
      {tables.map((table, i) => {
        const caption = title === undefined ? undefined : i === 0 ? title : `${title} (${i + 1})`;
        if (table.rows.length <= ALT_ROWS) {
          return (
            <table key={i}>
              {caption !== undefined && <caption>{caption}</caption>}
              <thead>
                <tr>{table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r}>{row.map((cell, c) => (c === 0 ? <th key={c} scope="row">{text(cell)}</th> : <td key={c}>{text(cell)}</td>))}</tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <p key={i}>{summary(caption, table)}</p>;
      })}
    </div>
  );
}

/** How many marks, the largest and the smallest by the first value column, and where the rows are. */
function summary(caption: string | undefined, table: Alternative): string {
  const value = table.keys;
  const ranked = value < table.columns.length ? [...table.rows].sort((a, b) => Number(a[value]) - Number(b[value])) : [];
  const part = (row: readonly unknown[] | undefined) => (row ? `${text(row[0])}, ${text(row[value])}` : "");
  return [
    `${caption ?? "Chart"}: ${text(table.rows.length)} marks.`,
    ranked.length > 0 ? `Largest: ${part(ranked.at(-1))}. Smallest: ${part(ranked[0])}.` : "",
    "Too many to list here; the rows are in the page's data table.",
  ].filter(Boolean).join(" ");
}
