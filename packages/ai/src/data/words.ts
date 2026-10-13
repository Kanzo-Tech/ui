import { nameWords, type DashboardMeasure } from "@kanzo-tech/ui/analytics";
import type { AnswerOutput } from "./read.js";
import type { AskSpec } from "./ask.js";

/**
 * **An answer in the reader's words** — its title, its chips and the sentence after it, written from
 * the spec and the rows, never by the model and never in column names: *Awards per laureate*, not
 * *Count by Laureate.name* (`/docs/design/tasks#an-answer-reads-in-the-persons-words`).
 */

/** The columns that name a row of their type: schema.org's `name`, RDFS's `label`, Dublin Core's `title`. */
const NAME = /^(name|label|title)$/i;

export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A type in words, one of it or several. */
export const typeWords = (type: string, n = 1) => nameWords(type, n);

const typeOf = (field: string) => field.slice(0, field.indexOf("."));
const columnOf = (field: string) => field.slice(field.indexOf(".") + 1);

/** Whether a field is the name of its type's rows, so the type stands for it: `Laureate.name` is *laureate*. */
const naming = (field: string) => NAME.test(columnOf(field));

/**
 * A field in words, on an answer about `of`: its column on the measured type (*gender*), its type
 * when it is that type's name (*laureate*), and its type and column otherwise (*laureate gender*).
 */
export function fieldWords(field: string, of: string): string {
  const type = typeOf(field);
  if (type === of) return nameWords(columnOf(field));
  return naming(field) ? nameWords(type) : `${nameWords(type)} ${nameWords(columnOf(field))}`;
}

const OP: Partial<Record<DashboardMeasure["op"], string>> = {
  distinct: "distinct",
  sum: "total",
  avg: "average",
  min: "lowest",
  max: "highest",
  median: "median",
};

/** What a measure counts or reads, in words: *awards*, *average share*. */
function measureWords(measure: DashboardMeasure, of: string): string {
  const field = measure.field ? fieldWords(measure.field, of) : "";
  if (measure.op === "count") return typeWords(of, 2);
  if (measure.op === "share") return `share with ${field} ${String(measure.equals)}`;
  return measure.op === "value" ? field : `${OP[measure.op]} ${field}`;
}

/** *per laureate* for a type's name, *by gender* for anything else. */
const by = (field: string, of: string) => `${naming(field) && typeOf(field) !== of ? "per" : "by"} ${fieldWords(field, of)}`;

/** The title an answer is drawn under: *Awards per laureate*, *Average share by laureate gender*, *Laureates*. */
export function answerTitle(spec: AskSpec): string {
  const { show, of } = spec;
  if (show.kind === "stat") return capital(measureWords(show.measure, of));
  if (show.kind === "table") return capital(typeWords(of, 2));
  if (show.type === "dot" || show.type === "regression") return capital(`${fieldWords(show.x, of)} and ${measureWords(show.y, of)}`);
  return capital(`${measureWords(show.y, of)} ${by(show.x, of)}${show.color ? ` and ${fieldWords(show.color, of)}` : ""}`);
}

/** The words of a spec, as a question a reader would ask: what the pills show and an edit is sent as. */
export function questionOf(spec: AskSpec): string {
  const { show, of } = spec;
  const measure = show.kind === "stat" ? show.measure : show.kind === "chart" ? show.y : undefined;
  const what = !measure || measure.op === "count" ? `How many ${typeWords(of, 2)}` : `${capital(measureWords(measure, of))} of ${typeWords(of, 2)}`;
  const shown = show.kind === "chart" ? ` ${by(show.x, of)}` : show.kind === "table" ? ` with ${show.columns.map((c) => fieldWords(c, of)).join(", ")}` : "";
  const where = (spec.where ?? []).map((c) => {
    const field = fieldWords(c.field, of);
    return "in" in c ? `${field} is ${c.in.join(" or ")}` : "between" in c ? `${field} is ${c.between.join("–")}` : `${field} contains ${c.contains}`;
  });
  return `${what}${shown}${where.length ? `, where ${where.join(" and ")}` : ""}?`;
}

const number = (value: unknown) => (typeof value === "number" ? value.toLocaleString("en", { maximumFractionDigits: 2 }) : String(value));

/** *a*, *a and b*, *a, b and c*, *a, b, c and 3 more*. */
function list(names: readonly string[]): string {
  const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  return shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}

/**
 * **The sentence after an answer**, written from its rows: the figure; or, for a bar chart, who leads
 * and who follows — ties named together, never ranked by the order the rows came in — and what the
 * count is of: every bar, the top the spec kept, or the first the cap let through.
 */
export function answerSummary(output: AnswerOutput, spec: AskSpec): string {
  if (output.unanswered.length > 0) return "None of these rows are in view under the page's filter.";
  const { rows } = output;
  if (rows.length === 0) return "No rows answer this.";
  const { show, of } = spec;
  if (show.kind === "stat") {
    const value = Object.values(rows[0]!)[0];
    return show.measure.op === "count" ? `${number(value)} ${typeWords(of, Number(value))}.` : `${capital(measureWords(show.measure, of))}: ${number(value)}.`;
  }
  const things = (n: number, words: string) => `${number(n)} ${nameWords(words, n)}`;
  if (show.kind === "table" || show.type === "dot" || show.type === "regression") {
    return `${things(rows.length, typeWords(of))}${output.truncated ? ", the first of more" : ""}.`;
  }
  const y = Object.keys(rows[0]!).at(-1)!;
  const count = show.y.op === "count";
  const amount = (v: unknown, each: boolean) =>
    count ? `${things(Number(v), typeWords(of))}${each ? " each" : ""}` : `${measureWords(show.y, of)} ${number(v)}${each ? " each" : ""}`;
  const label = (row: Record<string, unknown>) => (show.color ? `${String(row[show.x])} (${String(row[show.color])})` : String(row[show.x]));
  const ranked = [...rows].sort((a, b) => Number(b[y]) - Number(a[y]));
  const tier = (from: number) => ranked.slice(from).filter((row) => row[y] === ranked[from]![y]);
  const noun = fieldWords(show.x, of);
  const scope = output.truncated
    ? `the first ${things(rows.length, noun)}`
    : spec.top === rows.length
      ? `the top ${things(rows.length, noun)}`
      : `${things(rows.length, noun)} in all`;
  if (rows.length === 1) return `${label(rows[0]!)}: ${amount(rows[0]![y], false)}.`;
  // A line, an area or a histogram runs along its x: what reads is the peak, not a ranking.
  if (show.type !== "bar") return `The highest is ${label(ranked[0]!)}, with ${amount(ranked[0]![y], false)} — ${things(rows.length, "point")} in all.`;
  const first = tier(0);
  if (first.length === rows.length) return `${capital(scope.replace(/ in all$/, ""))}, with ${amount(first[0]![y], true)}: ${list(first.map(label))}.`;
  const second = tier(first.length);
  const lead = `${list(first.map(label))} ${first.length === 1 ? "leads" : "lead"} with ${amount(first[0]![y], first.length > 1)}`;
  return `${lead}, then ${list(second.map(label))} with ${amount(second[0]![y], second.length > 1)} — ${scope}.`;
}
