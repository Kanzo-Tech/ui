import type { Filter, Literal } from "@fossil-lang/corpus";
import { MosaicClient, clausePoints, type Selection } from "@kanzo-tech/mosaic";
import { GraphError } from "./error";

/**
 * **The page's crossfilter, as scan's typed filter.** The graph listens to the `Selection` rather
 * than being a client of the coordinator: a client hands the coordinator SQL to run, and the graph
 * has none — it hands fossil a `Filter` and fossil binds it. So this takes the half of Mosaic's
 * protocol that is about filtering: the `value` event, and `selection.predicate(client)`.
 *
 * The nodes are read by their `type`, never by importing mosaic-sql's classes: what arrives is
 * whatever the page's copy of mosaic-sql built.
 */

interface Node {
  readonly type?: string;
  readonly op?: string;
  readonly [field: string]: unknown;
}

const COMPARISONS: Record<string, "=" | "!=" | "<" | "<=" | ">" | ">="> = {
  "=": "=",
  "==": "=",
  "IS NOT DISTINCT FROM": "=",
  "<>": "!=",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
};
const MIRRORED = { "=": "=", "!=": "!=", "<": ">", "<=": ">=", ">": "<", ">=": "<=" } as const;

/** A predicate this cannot express as a `Filter` — reported, never dropped. */
const fail = (what: unknown): never => {
  throw new GraphError(
    "graph/untranslatable-filter",
    `the graph cannot express this crossfilter clause as a filter on the corpus: ${String(what)}`,
  );
};

function columnOf(node: unknown): string | null {
  const n = node as Node | null;
  if (n?.type === "COLUMN_REF" && typeof n.name === "string") return n.name;
  return null;
}

function literalOf(node: unknown): Literal {
  const n = node as Node | null;
  const value = n?.type === "LITERAL" || n?.type === "PARAM" ? n.value : fail(node);
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace("T", " ").replace("Z", "");
  }
  return fail(node);
}

function valuesOf(node: unknown): Literal[] {
  const n = node as Node | null;
  const list = Array.isArray(node) ? node : Array.isArray(n?.values) ? n.values : fail(node);
  return (list as unknown[]).map(literalOf);
}

/** One mosaic-sql expression node → one `Filter`. */
export function translate(node: unknown): Filter {
  const n = node as Node | null;
  if (Array.isArray(node)) return and(node.map(translate));
  switch (n?.type) {
    case "LOGICAL_OPERATOR": {
      const clauses = ((n.clauses as unknown[] | undefined) ?? []).map(translate);
      return n.op === "OR" ? { or: clauses } : and(clauses);
    }
    case "UNARY":
      if (n.op === "NOT") return { not: translate(n.expr) };
      return fail(node);
    case "UNARY_POSTFIX": {
      const column = columnOf(n.expr) ?? fail(node);
      if (n.op === "IS NULL") return { column, op: "is null" };
      if (n.op === "IS NOT NULL") return { column, op: "not null" };
      return fail(node);
    }
    case "BINARY": {
      const op = COMPARISONS[String(n.op).toUpperCase()] ?? fail(node);
      const left = columnOf(n.left);
      if (left !== null) return { column: left, op, value: literalOf(n.right) };
      const right = columnOf(n.right) ?? fail(node);
      return { column: right, op: MIRRORED[op], value: literalOf(n.left) };
    }
    case "BETWEEN":
    case "NOT_BETWEEN": {
      const column = columnOf(n.expr) ?? fail(node);
      const [lo, hi] = (n.extent as unknown[] | undefined) ?? fail(node);
      const within: Filter = and([
        { column, op: ">=", value: literalOf(lo) },
        { column, op: "<=", value: literalOf(hi) },
      ]);
      return n.type === "BETWEEN" ? within : { not: within };
    }
    case "IN": {
      const column = columnOf(n.expr) ?? fail(node);
      return { column, op: "in", values: valuesOf(n.values) };
    }
    default:
      return fail(node);
  }
}

const and = (clauses: Filter[]): Filter => (clauses.length === 1 ? (clauses[0] as Filter) : { and: clauses });

/** Every column a filter names, once each. */
export function columnsOf(filter: Filter): string[] {
  if ("column" in filter) return [filter.column];
  if ("and" in filter) return [...new Set(filter.and.flatMap(columnsOf))];
  if ("or" in filter) return [...new Set(filter.or.flatMap(columnsOf))];
  if ("not" in filter) return columnsOf(filter.not);
  return [];
}

/**
 * The page's filter for the graph, or `undefined` for none. `selection.predicate` skips the clause
 * the graph published itself, which is the exemption the next function takes back.
 */
export function filterFor(selection: Selection, self: MosaicClient): Filter | undefined {
  const predicate = selection.predicate(self) as unknown;
  const clauses = (Array.isArray(predicate) ? predicate : [predicate]).filter((p) => p !== undefined && p !== null);
  return clauses.length === 0 ? undefined : translate(clauses);
}

/**
 * An identity for `clients`, and nothing more: it is never connected, so the coordinator never
 * queries on its behalf.
 */
export function graphClient(): MosaicClient {
  return new MosaicClient();
}

/**
 * **The reader's pick, published** — naming the graph in `clients`, so the crossfilter skips it for
 * the graph and applies it to every chart. A canvas that draws only what survives would otherwise
 * answer a lasso of thirteen by removing the other 1,530.
 */
export function publish(
  selection: Selection,
  self: MosaicClient,
  column: string,
  ids: readonly number[] | null,
): void {
  selection.update(
    clausePoints([column], ids && ids.length > 0 ? ids.map((d) => [d]) : undefined, {
      source: self,
      clients: new Set([self]),
    }),
  );
}
