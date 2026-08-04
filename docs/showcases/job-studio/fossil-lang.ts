import { type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { type Diagnostic, linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { connectionSlots, referenceAt, slotsIn } from "./connection-slots";
import type { Connection } from "./data";

/**
 * A fossil language for CodeMirror, written HERE and not imported.
 *
 * ADR-0040 retires `@fossil-lang/{ui,editor,codemirror-fossil}` — fossil ships an LSP and its
 * verbs, nothing visual. So the surface a product needs is exactly what `CodeEditor` already
 * models: a domain-free lifecycle core plus an `extensions` slot the consumer fills. This file
 * is that slot, and the showcase is the proof it is enough.
 *
 * Everything here is deliberately *shallow* — a `StreamParser`, not a Lezer grammar, and a
 * regex analyser, not the wasm compiler. The real editor gets its diagnostics from the LSP over
 * a worker. What the showcase has to demonstrate is the WIRING (tokens → the Kanzo syntax
 * palette, diagnostics → the lint theme, `@` → connections), and the wiring is identical either
 * way.
 */

// The real grammar, from `rmlext/packages/examples/src/*/*.fossil`:
//
//   prefix ex: <https://example.org/>
//
//   users := io.csv("@examples/hello.csv")
//
//   User : ex:Person from users
//       iri = `${ex:}user/${.id}`
//       ex:name = .name

const KEYWORDS = new Set(["prefix", "from", "iri", "base", "graph", "where"]);

/** The stdlib source constructors — `io.csv(…)`, `io.rdf(…)`. */
const STDLIB = /^(io|core|str|num|date)\.[a-z_]+/;

interface FossilState {
  /** Inside a backtick template, where `${…}` is an interpolation and the rest is a string. */
  template: boolean;
  /** Inside a double-quoted string, which still has to surface its `@conn` reference. */
  string: boolean;
}

/** `@name`, optionally followed by a path. The one token that names something outside the file. */
const CONNECTION = /^@[A-Za-z][\w-]*(\/[^\s"')]*)?/;

/** The empty socket. A real token, so the analyser can object to it — see `connection-slots.ts`. */
const SLOT_TOKEN = /^@\?/;

const parser: StreamParser<FossilState> = {
  name: "fossil",
  startState: () => ({ template: false, string: false }),

  token(stream, state) {
    // ── Inside a template literal ──────────────────────────────────────────
    if (state.template) {
      if (stream.match("`")) {
        state.template = false;
        return "string";
      }
      // `${ex:}` / `${.field}` — the interpolation reads as code, not as string.
      if (stream.match(/^\$\{[^}]*\}?/)) return "variableName.special";
      stream.next();
      return "string";
    }

    // ── Inside a double-quoted string ───────────────────────────────────────
    // Not consumed in one bite, because a source URI is written `"@stations/x.csv"` — the
    // reference lives INSIDE the quotes, and swallowing the whole literal paints the one
    // token that points outside the program as if it were prose.
    if (state.string) {
      if (stream.match('"')) {
        state.string = false;
        return "string";
      }
      if (stream.match(SLOT_TOKEN)) return "slot";
      if (stream.match(CONNECTION)) return "connection";
      // Up to the next `@` or closing quote, whichever comes first.
      stream.next();
      stream.eatWhile((ch: string) => ch !== '"' && ch !== "@");
      return "string";
    }

    if (stream.eatSpace()) return null;

    // ── Comments ────────────────────────────────────────────────────────────
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // ── A connection reference: `@stations/stations.csv` ────────────────────
    if (stream.match(CONNECTION)) return "connection";

    // ── Strings and templates ───────────────────────────────────────────────
    if (stream.match("`")) {
      state.template = true;
      return "string";
    }
    if (stream.match('"')) {
      state.string = true;
      return "string";
    }

    // ── IRIs: <https://example.org/> ────────────────────────────────────────
    if (stream.match(/^<[^>\s]*>?/)) return "url";

    // ── Numbers ─────────────────────────────────────────────────────────────
    if (stream.match(/^\d+(\.\d+)?/)) return "number";

    // ── A field reference: `.name`, `.customer_id` ──────────────────────────
    if (stream.match(/^\.[A-Za-z_]\w*/)) return "propertyName";

    // ── Stdlib calls: `io.csv` ──────────────────────────────────────────────
    if (stream.match(STDLIB)) return "function";

    // ── A prefixed name: `ex:Person`, `ex:` ─────────────────────────────────
    if (stream.match(/^[A-Za-z_]\w*:/)) return "namespace";

    // ── Bare words: keyword, mapping name, or binding ───────────────────────
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return "keyword";
      // A leading capital in the mapping-header position is the mapping's name — a type.
      if (/^[A-Z]/.test(word)) return "typeName";
      return "variableName";
    }

    // ── Operators and punctuation ───────────────────────────────────────────
    if (stream.match(":=") || stream.match("=")) return "operator";
    stream.next();
    return "punctuation";
  },

  languageData: {
    commentTokens: { line: "//" },
  },

  // `connection` is not one of CodeMirror's legacy token names, so it needs its own tag or it
  // renders unstyled. `t.link` lands on `--syntax-function` in `kanzoHighlightStyle`, which is
  // exactly the "points outside this document" reading a `@conn` wants.
  tokenTable: {
    connection: t.link,
    // Mostly moot — the slot is replaced by a widget in the view — but it keeps the two
    // characters coloured as "not right yet" in any surface that renders tokens without it.
    slot: t.invalid,
  },
};

export const fossilLanguage = StreamLanguage.define(parser);

// ── Analysis ──────────────────────────────────────────────────────────────────
//
// One PURE function over the program text, because two different consumers need the same
// answer: the editor's lint gutter, and the chrome's validation badge. keasy has exactly this
// split and never closed it — the LSP's diagnostics stay inside the editor, so the wizard's
// `validating` flag is dead state (`job-editor-store.ts:64` declares `setValidating`; nothing
// calls it) and "Review" advances with a red program. Deriving both from one function is the
// fix, and it costs nothing.

export interface Finding {
  from: number;
  to: number;
  severity: "error" | "warning" | "info";
  message: string;
  line: number;
}

/** Every `@conn/path` in the program, with its offset — the program's external lineage. */
export function connectionRefs(program: string): { name: string; from: number; to: number }[] {
  const refs: { name: string; from: number; to: number }[] = [];
  const re = /@([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(program)) !== null) {
    refs.push({ name: m[1], from: m.index, to: m.index + m[0].length });
  }
  return refs;
}

const lineOf = (program: string, offset: number) =>
  program.slice(0, offset).split("\n").length;

/**
 * What the LSP would tell you, approximated. Three checks, each one a mistake this editor
 * actually invites: naming a connection that is not wired, using a prefix that was never
 * declared, and writing a mapping with no properties.
 */
export function analyse(program: string, connections: Connection[]): Finding[] {
  const findings: Finding[] = [];
  const known = new Set(connections.map((c) => c.name));

  // 0 — an unwired slot. The program parses; it just cannot run, because one of its sources
  //     names nothing. Reported as an error so the wizard's gate closes on it, which is what
  //     makes the drag target more than decoration.
  for (const slot of slotsIn(program)) {
    findings.push({
      ...slot,
      severity: "error",
      message: "This source has no connection yet — drop one here, or click to choose.",
      line: lineOf(program, slot.from),
    });
  }

  // 1 — a `@conn` that does not exist. The one error only the HOST can detect: fossil treats
  //     `@weather/x.csv` as opaque text (ADR-0029), so whether `weather` resolves is a keasy
  //     question, not a compiler one. This is the reason the product owns a linter at all.
  for (const ref of connectionRefs(program)) {
    if (!known.has(ref.name)) {
      findings.push({
        ...ref,
        severity: "error",
        message: `No connection named “${ref.name}”. Add it under Connections, or pick one from the list.`,
        line: lineOf(program, ref.from),
      });
    }
  }

  // 2 — a prefix used but never declared.
  const declared = new Set<string>();
  for (const m of program.matchAll(/^\s*prefix\s+([A-Za-z_]\w*):/gm)) declared.add(m[1]);
  const seen = new Set<string>();
  for (const m of program.matchAll(/(?<![\w.$])([A-Za-z_]\w*):(?![/=])/g)) {
    const name = m[1];
    if (declared.has(name) || seen.has(name)) continue;
    // The `prefix ex:` declaration itself, and anything inside a comment, are not uses.
    const lineStart = program.lastIndexOf("\n", m.index) + 1;
    const before = program.slice(lineStart, m.index);
    if (/^\s*(prefix\b|\/\/)/.test(before)) continue;
    seen.add(name);
    findings.push({
      from: m.index,
      to: m.index + name.length + 1,
      severity: "error",
      message: `Prefix “${name}:” is used but never declared. Add \`prefix ${name}: <…>\` at the top.`,
      line: lineOf(program, m.index),
    });
  }

  // 3 — a mapping header with no indented properties under it. Valid to parse, useless to run:
  //     it emits a subject and nothing else.
  const lines = program.split("\n");
  lines.forEach((text, i) => {
    const header = /^([A-Z]\w*)\s*:\s*\S+\s+from\s+\w+\s*$/.exec(text);
    if (!header) return;
    const body = lines.slice(i + 1).findIndex((l) => l.trim() !== "");
    const next = body === -1 ? undefined : lines[i + 1 + body];
    if (next && /^\s+\S/.test(next)) return;
    const from = lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
    findings.push({
      from,
      to: from + text.length,
      severity: "warning",
      message: `Mapping “${header[1]}” has no properties — it will emit a subject and nothing else.`,
      line: i + 1,
    });
  });

  return findings.sort((a, b) => a.from - b.from);
}

// ── The extension ─────────────────────────────────────────────────────────────

/**
 * `@` opens the connection list. The completion is the reason a `ConnectionResolver` exists in
 * keasy (`step-script.tsx:45`) — here the list is just data, so the adapter disappears.
 */
function connectionCompletion(connections: Connection[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/@[\w-]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: connections.map((c) => ({
        label: `@${c.name}`,
        // `type` picks the icon in the popover; the two kinds read differently at a glance.
        type: c.kind === "vocab" ? "class" : "variable",
        detail: c.kind === "vocab" ? "RDF vocabulary" : "data source",
        info: c.url,
        // A function, not a string: completing into a slot that already has a path written
        // after it must not add a second separator — the same trap the drop handler hit.
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          const text = referenceAt(view.state.doc.sliceString(to, to + 1), c);
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
      })),
    };
  };
}

/**
 * The whole language as one extension — tokens, diagnostics and completion, parameterised by
 * the connections the org has wired. Memoise it on `connections` in the consumer: `CodeEditor`
 * reconfigures its language compartment whenever this identity changes.
 */
export function fossil(connections: Connection[]): Extension {
  return [
    fossilLanguage,
    fossilLanguage.data.of({ autocomplete: connectionCompletion(connections) }),
    connectionSlots,
    linter(
      (view): Diagnostic[] =>
        analyse(view.state.doc.toString(), connections).map((f) => ({
          from: f.from,
          to: f.to,
          severity: f.severity,
          message: f.message,
        })),
      { delay: 250 },
    ),
  ];
}

// ── What the program will emit ────────────────────────────────────────────────
//
// The same regex reading as `analyse`, turned the other way round: instead of what is wrong with
// the program, what it PRODUCES. This is what a review step is actually for — restating the
// settings you just typed is not review, it is a receipt for a form. metadata-form's third column
// shows generated Turtle and JSON-LD for the same reason.

export interface EmittedProperty {
  /** The predicate, as written: `ex:name`, `sosa:madeBySensor`. */
  predicate: string;
  /** Where its value comes from: `.nombre`, or a template. */
  value: string;
}

export interface Mapping {
  /** The mapping's own name — `Station`. */
  name: string;
  /** The class each subject gets — `sosa:Platform`. */
  type: string;
  /** The source binding it reads — `stations`. */
  binding: string;
  /** That binding's URI, if the program declares one: `@stations/stations.csv`. */
  source?: string;
  /** The `iri = …` template that mints each subject. */
  subject?: string;
  properties: EmittedProperty[];
}

/** `name := io.csv("uri")` — the binding table a mapping's `from` refers into. */
function bindings(program: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of program.matchAll(/^\s*(\w+)\s*:=\s*[\w.]+\(\s*"([^"]*)"/gm)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/**
 * Every mapping, with the shape it emits.
 *
 * A mapping is a header line plus the indented block under it, which is exactly how the language
 * reads on the page — so the parse is a line walk rather than a grammar. Good enough for a
 * preview; the compiler is the authority, and it is not in the browser.
 */
export function mappingsIn(program: string): Mapping[] {
  const sources = bindings(program);
  const lines = program.split("\n");
  const out: Mapping[] = [];

  lines.forEach((text, i) => {
    const header = /^([A-Z]\w*)\s*:\s*(\S+)\s+from\s+(\w+)\s*$/.exec(text);
    if (!header) return;

    const mapping: Mapping = {
      name: header[1],
      type: header[2],
      binding: header[3],
      source: sources.get(header[3]),
      properties: [],
    };

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      // The block ends at the first line that is not indented.
      if (!/^\s/.test(line)) break;
      const prop = /^\s+([\w:]+)\s*=\s*(.+?)\s*$/.exec(line);
      if (!prop) continue;
      if (prop[1] === "iri") mapping.subject = prop[2];
      else mapping.properties.push({ predicate: prop[1], value: prop[2] });
    }

    out.push(mapping);
  });

  return out;
}
