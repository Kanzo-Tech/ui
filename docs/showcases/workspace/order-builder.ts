import {
  CONSTRAINT_KINDS,
  type ConstraintKind,
  constraintText,
  readOrders,
  type Severity,
} from "./orders";

/**
 * The other direction of `./orders`: an order you can pick from menus, written back out.
 *
 * The builder holds no state the document does not. An order is parsed out of the file and written
 * back into it, so the panel keeps ONE source of truth — the text — and everything downstream
 * (compile → counts → focus) runs on a document the reader could equally have dropped on it. That is
 * the whole claim: the thing you build is the hall's standing orders, not a picture of them.
 */

export { CONSTRAINT_KINDS, type ConstraintKind } from "./orders";

export interface Rule {
  id: string;
  /** What the order is called, in quotes at the top of its block. */
  name: string;
  /** The kind it is read against: `contract`. */
  target: string;
  /** The property it constrains: `tags`. */
  path: string;
  kind: ConstraintKind;
  /** The constraint value. For `one of`, the members separated by commas. */
  value: string;
  severity: Severity;
  /** What the order says when it is broken. */
  message: string;
}

export interface ParseResult {
  rules: Rule[];
  /**
   * Whether the rules are the WHOLE document. False when it holds something the builder cannot write
   * back — an unreadable clause, a `forbid`, two clauses sharing one block. Regenerating then would
   * drop it, so the panel refuses to edit rather than lose it silently.
   */
  exact: boolean;
  /** What made it inexact, in the document's own words. */
  lost: string[];
}

export function members(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * A quoted string, with no escape hatch — because the reader next door has none either.
 *
 * `readOrders` treats `"` as a plain delimiter: a language this small does not earn a backslash
 * grammar, and a writer that emitted `\\"` would produce a file its own parser could not read. So a
 * quote inside a message becomes a typographic one, which is what it should have been anyway.
 */
function quote(value: string): string {
  return `"${value.replace(/"/g, "”")}"`;
}

/**
 * What the builder calls an order it has just been given, and what it says when broken.
 *
 * Derived rather than asked for, and that is a decision rather than an omission: a builder cannot
 * write prose, and a sixth control asking the reader to write some — in a 320px dock, before they
 * can press Add — would buy a sentence nobody reads. The panel shows the clause, not the message.
 *
 * A file that arrives with its own name and message keeps both verbatim through the round trip, so
 * the derived form only ever appears on an order this builder made.
 */
function sentence(rule: Omit<Rule, "id" | "name" | "message">): { name: string; message: string } {
  const clause = constraintText({
    path: rule.path,
    kind: rule.kind,
    value: rule.kind === "one of" ? members(rule.value) : rule.value,
  });
  return {
    name: `every ${rule.target} — ${clause}`,
    message: `A ${rule.target} failing “${clause}” is not in order.`,
  };
}

/** The rules as a document: one `order` block each, in the order they were built. */
export function toOrders(rules: readonly Omit<Rule, "id">[]): string {
  const blocks = rules.map((rule) => {
    const value = rule.kind === "one of" ? `(${members(rule.value).join(", ")})` : rule.value;
    return [
      `order ${quote(rule.name)} {`,
      `  when    ${rule.target}`,
      `  require ${rule.path} ${rule.kind} ${value}`,
      `  else    ${rule.severity} ${quote(rule.message)}`,
      "}",
    ].join("\n");
  });

  return `${HEADER}\n\n${blocks.join("\n\n")}\n`;
}

const HEADER = `# The Amber Hall's standing orders, as the archivist reads them.
# Checked against the archive — what has been closed — not against the live board.`;

/** A rule the builder has been handed, with the two derived fields filled in. */
export function ruleFrom(draft: Omit<Rule, "id" | "name" | "message">): Omit<Rule, "id"> {
  return { ...draft, ...sentence(draft) };
}

/**
 * Read a document back into rules, and say whether that reading was lossless.
 *
 * Formatting and comments do not survive a round trip — the document is regenerated, not patched.
 * What must survive is MEANING, so anything carrying meaning the builder cannot re-emit makes the
 * result inexact and the panel read-only.
 */
export function parseRules(source: string): ParseResult {
  const { blocks, errors } = readOrders(source);
  const rules: Rule[] = [];
  const lost: string[] = [...errors];

  for (const block of blocks) {
    // Two clauses in one block would come back out as two blocks, and the second would inherit a
    // name and a message written for the first.
    if (block.clauses.length > 1) {
      lost.push(`${block.name} — ${block.clauses.length} clauses in one order`);
      continue;
    }
    const clause = block.clauses[0];
    if (!clause) continue;
    if (clause.verb !== "require" || !clause.kind) {
      lost.push(clause.text);
      continue;
    }
    rules.push({
      id: `${block.name}|${clause.path}|${clause.kind}`,
      name: block.name,
      target: block.target,
      path: clause.path,
      kind: clause.kind,
      value: clause.kind === "one of" ? (clause.value as string[]).join(", ") : String(clause.value),
      severity: block.severity,
      message: block.message,
    });
  }

  return { rules, exact: lost.length === 0, lost };
}

/** Whether a value is usable for this constraint — what the Add button waits for. */
export function isValidValue(kind: ConstraintKind, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (kind === "at least" || kind === "at most") return /^\d+$/.test(trimmed);
  if (kind === "one of") return members(trimmed).length > 0;
  if (kind === "matches") {
    try {
      new RegExp(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
