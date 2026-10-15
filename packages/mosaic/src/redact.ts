/**
 * A statement's text, or DuckDB's message about it, with every literal replaced by `?`: strings,
 * dollar-quoted strings and numbers, and a list of them (`IN (1, 2, 3)`, a tuple) as one `?`. What is
 * left is the statement's shape, which is what a maintainer needs to find the clause that failed and
 * all a host's telemetry should carry. Quoted identifiers (`"name"`) are kept: they name columns and
 * relations, not what a user typed. Comments go, since a literal can sit in one.
 *
 * It scans the text rather than matching it with one expression, because a quote opens a literal
 * only outside another: `'it''s'` is one string, and `"a'b"` is an identifier. An unterminated
 * quote redacts to the end, so the failure it can have is to hide too much. A message that is prose
 * with an apostrophe in it is redacted from there on, which the same rule makes safe.
 */
export function redact(text: string): string {
  let out = "";
  let at = 0;
  while (at < text.length) {
    const rest = text.slice(at);
    const literal =
      /^'(?:[^']|'')*(?:'|$)/.exec(rest) ?? // a string, its quote doubled to escape one
      /^\$([A-Za-z_]\w*)?\$[\s\S]*?(?:\$\1\$|$)/.exec(rest) ?? // a dollar-quoted string, to its twin tag
      (/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\b/.test(rest) && !/[\w$.]$/.test(out) ? /^\S+?(?=[^\w.]|$)/.exec(rest) : null);
    if (literal) {
      out += "?";
      at += literal[0].length;
      continue;
    }
    const kept = /^"(?:[^"]|"")*(?:"|$)|^--[^\n]*|^\/\*[\s\S]*?(?:\*\/|$)|^[\s\S]/.exec(rest)![0];
    out += kept.startsWith("--") || kept.startsWith("/*") ? " " : kept;
    at += kept.length;
  }
  return out.replace(/\?(?:\s*,\s*\?)+/g, "?");
}

/** A `CREATE SECRET`, the one statement whose text and whose failure are never echoed at all. */
export const isSecret = (sql: string) => /^\s*create\s+(?:or\s+replace\s+)?(?:(?:persistent|temporary)\s+)?secret\b/i.test(redact(sql));
