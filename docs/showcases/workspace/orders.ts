import {
  and,
  column,
  eq,
  gt,
  isIn,
  isNull,
  literal,
  lt,
  not,
  or,
  regexp_matches,
  sql,
  type ExprNode,
} from "@uwdata/mosaic-sql";

/**
 * The hall's standing orders → SQL, for the subset a column-shaped relation can answer.
 *
 * An order and a SQL predicate are the same statement in two notations, provided you know which
 * column a property lands on. That mapping is the one thing the document cannot tell you, so it
 * arrives as a {@link Binding} argument rather than living here: `tags` is a `|`-joined column,
 * `reports` is already a count, `closed` is a DATE. Point the same document at another relation by
 * passing another binding — {@link ARCHIVE_BINDING} is simply the one this showcase loads.
 * Everything else falls out.
 *
 * The language is the world's own. `@/example/rules` holds the board's standing orders, checked when
 * a party signs; this is the archivist's copy, read against what the halls have already closed. Same
 * grammar, different relation — which is the point of taking the binding as an argument.
 *
 *   order "a contract is signed for" {
 *     when    contract
 *     require signed at least 1
 *     else    violation "A contract nobody put their name to."
 *   }
 *
 * The predicates are expression nodes, never strings. Values come out of somebody's orders file, and
 * a compiler that builds SQL by concatenation owns every quote, every escape and every type by hand
 * — which is where a `DATE` column compared to `''` came from. It also quotes identifiers, so a
 * column called `order` does not take the report down with it.
 *
 * **What is supported**, because it maps cleanly: `when`, `require`, `at least`, `at most`,
 * `not before`, `not after`, `one of`, `matches`, and the three severities on `else`.
 *
 * **What is not**: `forbid`, and the board's own clause forms — `party.size >= 4`, `party has role`,
 * `tagged`. Those are reported by name as unsupported rather than dropped: a validator that quietly
 * ignores half a document is worse than one that refuses it, because you cannot tell the difference
 * between "in order" and "never read".
 */

export type Severity = "violation" | "warning" | "info";

export const CONSTRAINT_KINDS = [
  "at least",
  "at most",
  "not before",
  "not after",
  "one of",
  "matches",
] as const;

export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

export interface Order {
  id: string;
  /** The kind of vertex it is read against, as written: `contract`. */
  target: string;
  /** The clause, as a reader of the orders would write it. */
  constraint: string;
  severity: Severity;
  /** The predicate identifying the nodes that FAIL the clause. */
  failing: ExprNode;
}

export interface CompileResult {
  orders: Order[];
  /** Clauses recognised as orders but outside the supported subset. */
  unsupported: string[];
  errors: string[];
}

/**
 * How a property lands on the node relation.
 *
 * `multi` means the column holds several values joined by `|`, so cardinality is a token count;
 * `count` means the column already *is* the cardinality.
 */
export interface ColumnBinding {
  column: string;
  kind: "scalar" | "multi" | "count";
  /**
   * How the column stores its values. It decides two things a `kind` alone cannot: the literal
   * syntax, and what counts as absent — only text can be blank as well as null.
   *
   * @default "text"
   */
  datatype?: "text" | "date" | "number";
}

/**
 * Everything the compiler would otherwise have to invent.
 *
 * The orders say nothing about columns, so something has to say which column a property lands on and
 * which rows a `when` selects. Taking it as an argument is what makes this a compiler for the
 * language rather than a compiler for one particular table.
 */
export interface Binding {
  /** Property name → the column it lands on. */
  paths: Record<string, ColumnBinding>;
  /** `when` value → the value that selects those rows. */
  targets: Record<string, string>;
  /** The column carrying the kind a `when` names. */
  discriminator: string;
}

/** The binding for the archive node relation the workspace showcase loads. */
export const ARCHIVE_BINDING: Binding = {
  discriminator: "kind",
  paths: {
    closed: { column: "closed", kind: "scalar", datatype: "date" },
    signed: { column: "signed", kind: "scalar" },
    hall: { column: "hall", kind: "scalar" },
    region: { column: "region", kind: "scalar" },
    /** A report's own name is the role that filed it — the one place `label` carries a vocabulary. */
    filed: { column: "label", kind: "scalar" },
    tags: { column: "tags", kind: "multi" },
    reports: { column: "reports", kind: "count", datatype: "number" },
    /**
     * How many other things in the archive touch it.
     *
     * `count`, not `scalar`, and the difference is the whole reason `kind` exists: a degree column
     * already *is* a cardinality, so `links at least 2` has to compare the number rather than ask
     * whether the column has a value. As a scalar it would answer "does this row have a degree",
     * which is true of every row — an order that flags the entire relation or none of it.
     */
    links: { column: "degree", kind: "count", datatype: "number" },
  },
  // An identity map today, and still worth being a map: the archive happens to name its vertices
  // the way the orders do, and the board relation — same language, different table — does not.
  targets: {
    contract: "contract",
    report: "report",
    member: "member",
    beast: "beast",
    tag: "tag",
    region: "region",
  },
};

const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value);

/* -------------------------------------------------------------------------------------------- */
/* Reading                                                                                       */
/* -------------------------------------------------------------------------------------------- */

/** One clause of an order, exactly as the document wrote it. */
export interface Clause {
  /** `require`, or whatever verb was actually written — an unsupported one is still reported. */
  verb: string;
  path: string;
  /** The constraint, when it is one the orders know. */
  kind?: ConstraintKind;
  value: string | string[];
  /** The clause as written, so a diagnostic can quote the document back at the reader. */
  text: string;
  line: number;
}

export interface OrderBlock {
  name: string;
  target: string;
  clauses: Clause[];
  severity: Severity;
  message: string;
  line: number;
}

export interface OrdersDocument {
  blocks: OrderBlock[];
  errors: string[];
}

const SEVERITIES: Severity[] = ["violation", "warning", "info"];

/**
 * Words, with quoted strings kept whole and `#` comments dropped.
 *
 * The comment test has to know about quotes: a message is allowed to contain one, and stripping from
 * the first `#` on the line would eat half of it.
 */
function words(line: string): string[] {
  const out: string[] = [];
  let token = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        out.push(token);
        token = "";
        quoted = false;
      } else {
        token += ch;
      }
      continue;
    }
    if (ch === "#") break;
    if (ch === '"') {
      if (token) out.push(token);
      token = "";
      quoted = true;
      continue;
    }
    // `(`, `)` and `,` are punctuation in `one of ( a, b )` — separated so the list reads the same
    // whether or not the writer left spaces around them.
    if (ch === "(" || ch === ")" || ch === "," || ch === "{" || ch === "}") {
      if (token) out.push(token);
      token = "";
      if (ch !== ",") out.push(ch);
      continue;
    }
    if (/\s/.test(ch)) {
      if (token) out.push(token);
      token = "";
      continue;
    }
    token += ch;
  }
  if (token) out.push(token);
  return out;
}

/** The constraint a clause's tail spells, or nothing when it spells something else. */
function constraintOf(tail: string[]): { kind: ConstraintKind; value: string | string[] } | null {
  const two = `${tail[0] ?? ""} ${tail[1] ?? ""}`;
  if (tail[0] === "matches" && tail[1] !== undefined) {
    return { kind: "matches", value: tail[1] };
  }
  if (two === "one of") {
    const open = tail.indexOf("(");
    const close = tail.lastIndexOf(")");
    if (open < 0 || close < open) return null;
    return { kind: "one of", value: tail.slice(open + 1, close) };
  }
  if ((CONSTRAINT_KINDS as readonly string[]).includes(two) && tail[2] !== undefined) {
    return { kind: two as ConstraintKind, value: tail[2] };
  }
  return null;
}

/**
 * The document, as blocks. One parser, used by the compiler below and by the builder next door —
 * because two readings of one file is how a panel ends up validating something it cannot edit.
 */
export function readOrders(source: string): OrdersDocument {
  const blocks: OrderBlock[] = [];
  const errors: string[] = [];
  const lines = source.split("\n");

  let open: OrderBlock | null = null;

  for (let n = 0; n < lines.length; n++) {
    const parts = words(lines[n] ?? "");
    if (parts.length === 0) continue;
    const at = `line ${n + 1}`;

    if (open === null) {
      if (parts[0] !== "order") {
        errors.push(`${at}: expected an \`order\` block, found \`${parts[0]}\`.`);
        continue;
      }
      if (parts.length < 3 || parts[2] !== "{") {
        errors.push(`${at}: an order is written \`order "name" {\`.`);
        continue;
      }
      open = {
        name: parts[1] ?? "",
        target: "",
        clauses: [],
        severity: "violation",
        message: "",
        line: n + 1,
      };
      continue;
    }

    if (parts[0] === "}") {
      if (open.target === "") errors.push(`line ${open.line}: \`${open.name}\` never says \`when\`.`);
      else if (open.clauses.length === 0) errors.push(`line ${open.line}: \`${open.name}\` requires nothing.`);
      else blocks.push(open);
      open = null;
      continue;
    }

    if (parts[0] === "when") {
      if (parts[1] === undefined) errors.push(`${at}: \`when\` names the kind an order is read against.`);
      else open.target = parts[1];
      continue;
    }

    if (parts[0] === "else") {
      const severity = SEVERITIES.find((entry) => entry === parts[1]);
      open.severity = severity ?? "violation";
      open.message = (severity ? parts[2] : parts[1]) ?? "";
      continue;
    }

    // Everything else is a clause. An unknown verb is kept rather than dropped, so the panel can say
    // which line it declined to read.
    const tail = parts.slice(2);
    const constraint = constraintOf(tail);
    const clause: Clause = {
      verb: parts[0] ?? "",
      path: parts[1] ?? "",
      value: constraint ? constraint.value : tail.join(" "),
      text: parts.join(" "),
      line: n + 1,
    };
    if (constraint) clause.kind = constraint.kind;
    open.clauses.push(clause);
  }

  if (open !== null) errors.push(`line ${open.line}: \`${open.name}\` is never closed.`);
  return { blocks, errors };
}

/* -------------------------------------------------------------------------------------------- */
/* Compiling                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * Whether the property has no value at all.
 *
 * The blank test is only valid on text. DuckDB does not read `closed = ''` on a DATE column as
 * false, it reads it as a conversion error — and one such clause fails the whole report, since every
 * order's count rides in a single query.
 */
function absent(binding: ColumnBinding): ExprNode {
  const col = column(binding.column);
  return (binding.datatype ?? "text") === "text"
    ? or(isNull(col), eq(col, literal("")))
    : isNull(col);
}

/** How many values the property has, per node. */
function cardinality(binding: ColumnBinding): ExprNode {
  const col = column(binding.column);
  if (binding.kind === "count") return col;
  if (binding.kind === "multi") {
    return sql`CASE WHEN ${absent(binding)} THEN 0 ELSE len(string_split(${col}, '|')) END`;
  }
  return sql`CASE WHEN ${absent(binding)} THEN 0 ELSE 1 END`;
}

/** A constraint value as the literal its column expects. */
function valueOf(binding: ColumnBinding, value: string): ExprNode {
  if (binding.datatype === "date") return sql`DATE ${literal(value)}`;
  return literal(isNumeric(value) ? Number(value) : value);
}

/**
 * The predicate that identifies nodes FAILING one clause.
 *
 * Expression nodes, not a string. The values reaching here come out of somebody's orders file, and a
 * compiler that builds SQL by concatenation has to get every quote, every escape and every type
 * right by hand — which is exactly where `closed = ''` came from. `literal()` knows what a value is;
 * `column()` knows what an identifier is.
 */
function failingExpr(
  binding: Binding,
  selects: string,
  clause: Clause,
): ExprNode | null {
  const col = binding.paths[clause.path];
  if (!col || !clause.kind) return null;
  const isTarget = eq(column(binding.discriminator), literal(selects));
  const value = String(clause.value);

  switch (clause.kind) {
    case "at least":
      // A cardinality compares against a number or against nothing at all.
      return isNumeric(value) ? and(isTarget, lt(cardinality(col), literal(Number(value)))) : null;
    case "at most":
      return isNumeric(value) ? and(isTarget, gt(cardinality(col), literal(Number(value)))) : null;
    case "not before":
      return and(isTarget, lt(column(col.column), valueOf(col, value)));
    case "not after":
      return and(isTarget, gt(column(col.column), valueOf(col, value)));
    case "matches":
      return and(isTarget, not(regexp_matches(column(col.column), literal(value))));
    case "one of":
      return and(
        isTarget,
        not(isIn(column(col.column), (clause.value as string[]).map((v) => literal(v)))),
      );
    default:
      return null;
  }
}

/** The clause, in the notation the document uses. */
export function constraintText(clause: Pick<Clause, "path" | "kind" | "value">): string {
  if (clause.kind === "one of") {
    return `${clause.path} one of (${(clause.value as string[]).join(", ")})`;
  }
  return `${clause.path} ${clause.kind} ${clause.value}`;
}

/** Read a standing-orders document and compile what it can into SQL predicates. */
export function compileOrders(source: string, binding: Binding = ARCHIVE_BINDING): CompileResult {
  const orders: Order[] = [];
  const unsupported: string[] = [];
  const { blocks, errors } = readOrders(source);

  if (blocks.length === 0 && errors.length === 0) {
    errors.push("No orders here — nothing to read the archive against.");
  }

  for (const block of blocks) {
    const kind = binding.targets[block.target];
    if (!kind) {
      unsupported.push(`${block.target} — no rows are mapped to this kind`);
      continue;
    }

    for (const clause of block.clauses) {
      if (clause.verb !== "require") {
        unsupported.push(`${clause.verb} — outside the supported subset`);
        continue;
      }
      if (!clause.kind) {
        unsupported.push(`${clause.text} — the orders cannot read this clause`);
        continue;
      }
      const failing = failingExpr(binding, kind, clause);
      if (!failing) {
        unsupported.push(`${clause.path} — no column is mapped to this property`);
        continue;
      }
      orders.push({
        id: `${block.name}|${clause.path}|${clause.kind}`,
        target: block.target,
        constraint: constraintText(clause),
        severity: block.severity,
        failing,
      });
    }
  }

  return { orders, unsupported, errors };
}

/**
 * How a property stores its values, for a caller that has to pick a CONTROL for one.
 *
 * The builder needs this for the same reason the compiler does: a date is not a number is not a
 * string, and guessing from the value is how you end up with `DATE ''`.
 */
export function pathDatatype(
  path: string,
  binding: Binding = ARCHIVE_BINDING,
): "text" | "date" | "number" | undefined {
  const col = binding.paths[path];
  return col && (col.datatype ?? "text");
}

/** What a document may talk about, for a panel that has to offer the choice. */
export const SUPPORTED_PATHS = Object.keys(ARCHIVE_BINDING.paths);
export const SUPPORTED_TARGETS = Object.keys(ARCHIVE_BINDING.targets);

/**
 * The orders the panel opens with — a real document, not a JS array dressed up as one, so "in order"
 * and "in breach" are answers to the same file a reader could have dropped on it.
 *
 * Every number it produces is measured against the shipped archive: 25 contracts closed before the
 * Lanternwood charter, 231 that no warden signed, 354 posted with fewer than three tags, 245 with
 * fewer than two field reports, 432 reports filed by a role the hall does not take the word of — and
 * one order that passes clean, because a report where everything fails teaches nothing about what a
 * tick means.
 */
export const DEFAULT_ORDERS = `# The Amber Hall's standing orders, as the archivist reads them.
# Checked against the archive — what has been closed — not against the live board.

order "nothing older than the youngest charter" {
  when    contract
  require closed not before 1305-01-01
  else    violation "Older than the Lanternwood Compact. Whoever filed it, filed it somewhere else."
}

order "a contract is signed for" {
  when    contract
  require signed at least 1
  else    violation "No warden's name on it. A contract nobody signed is a contract nobody can be asked about."
}

order "three tags or the board cannot find it" {
  when    contract
  require tags at least 3
  else    warning "Posted with too few tags to be found twice."
}

order "somebody wrote it down" {
  when    contract
  require reports at least 2
  else    warning "One report or none. The hall keeps what was seen, not what was remembered."
}

order "the hall takes three roles' word in the field" {
  when    report
  require filed one of (warden, archivist, scout)
  else    violation "Filed by someone the orders do not send to look."
}

order "a tag nobody shares is not a tag" {
  when    tag
  require links at least 2
  else    warning "Used once and never again — that is a note, not a tag."
}
`;
