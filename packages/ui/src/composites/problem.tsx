// A failure, shown: anything a `catch` holds, read in the shape every coded error here shares —
// `code` (`area/kind`), `title`, `message`, `data`, `cause` — and drawn over `Diagnostic`'s parts,
// with its causes nested below it. No hook and no handler of its own, so no `"use client"`: the
// parts it renders carry theirs.

import { ark } from "@ark-ui/react/factory";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticHeader,
  DiagnosticList,
  type DiagnosticProps,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
} from "../simples/diagnostic.js";

/** A host's words for one code, where its reader differs from the one the code's author wrote for. */
export interface ProblemCopy {
  /** Replaces the error's `title`. */
  title?: string;
  /** Replaces the error's `message`; the error's own row is kept one level down, closed. */
  detail?: string;
  /** A way out, drawn as a button beside the details: "Sign in again". */
  link?: { label: string; href: string };
  /** The page that explains the code. The code, in the header, links to it. */
  page?: string;
}

/** Keyed by `Diagnostic`'s variant, which a severity maps to: `error` is `destructive`. */
export interface ProblemTranslations {
  destructive: string;
  warning: string;
  info: string;
  /** The details trigger's accessible name, given the row's title. */
  details: (title: string) => string;
}

const ENGLISH: ProblemTranslations = {
  destructive: "Error",
  warning: "Warning",
  info: "Note",
  details: (title) => `Details: ${title}`,
};

type Severity = "error" | "warning" | "info";

const VARIANT = { error: "destructive", warning: "warning", info: "info" } as const;

/** `area/kind`: two lowercase kebab-case words — the grammar every coded error here is written in. */
const CODE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\/[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Past this, a chain of causes is a cycle or a fault of its own, and the tree stops drawing it. */
const DEPTH = 8;

interface Row {
  code?: string;
  title: string;
  detail?: string;
  help?: string;
  severity: Severity;
  link?: ProblemCopy["link"];
  page?: string;
  children: Row[];
}

type Copy = (code: string, data: unknown) => ProblemCopy | undefined;

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * Any thrown value as a row. An object is read for the shared fields, whatever its class: a
 * library's coded `Error`, a server's problem body, an event a stream handed over. Anything else is
 * its own `String`.
 */
function read(value: unknown, copy: Copy | undefined, seen: Set<unknown>, depth: number): Row {
  if (typeof value !== "object" || value === null) return { title: String(value), severity: "error", children: [] };
  seen.add(value);
  const shape = value as Record<string, unknown>;
  const code = typeof shape.code === "string" && CODE.test(shape.code) ? shape.code : undefined;
  const message = text(shape.message) ?? text(shape.detail);
  const title = text(shape.title) ?? message ?? text(shape.name) ?? String(value);
  const severity: Severity =
    shape.severity === "warning" || shape.severity === "info" ? shape.severity : "error";

  const children: Row[] = [];
  const cause = shape.cause;
  if (cause !== undefined && cause !== null && !seen.has(cause) && depth < DEPTH) {
    children.push(read(cause, copy, seen, depth + 1));
  }
  if (Array.isArray(shape.related) && depth < DEPTH) {
    for (const related of shape.related) children.push(read(related, copy, seen, depth + 1));
  }

  const own: Row = {
    code,
    title,
    detail: message === title ? undefined : message,
    help: text(shape.help),
    severity,
    children,
  };
  const worded = code === undefined ? undefined : copy?.(code, shape.data);
  if (!worded) return own;
  return {
    ...own,
    title: worded.title ?? own.title,
    detail: worded.detail ?? own.detail,
    link: worded.link,
    page: worded.page,
    // A detail the host rewrote is not lost: the author's row sits under it, in the author's words.
    children: worded.detail === undefined ? children : [{ ...own, children: [] }, ...children],
  };
}

function Item(props: {
  row: Row;
  t: ProblemTranslations;
  root?: Omit<DiagnosticProps, "variant">;
  actions?: React.ReactNode;
}) {
  const { row, t, root, actions } = props;
  const more = Boolean(row.detail || row.help || row.children.length > 0);
  const { className, ...rest } = root ?? {};

  return (
    // A coded cause is part of the explanation, so it is open; an uncoded one stays folded.
    <Diagnostic
      className={cn("@container", className)}
      data-code={row.code}
      defaultOpen={row.code !== undefined}
      {...rest}
      variant={VARIANT[row.severity]}
    >
      <DiagnosticHeader className="flex-nowrap items-start">
        {/* The title takes the rest of the line and the actions stay at its end. In a narrow container
            the title takes a line of its own under severity and code instead of a word per line. */}
        <ark.div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-2">
          <DiagnosticSeverity>{t[VARIANT[row.severity]]}</DiagnosticSeverity>
          <DiagnosticTitle className="@max-md:order-last @max-md:basis-full @max-md:whitespace-normal">
            {row.title}
          </DiagnosticTitle>
          {row.code === undefined ? null : (
            <DiagnosticSource asChild>
              {row.page ? (
                <a href={row.page} rel="noreferrer" target="_blank">
                  {row.code}
                </a>
              ) : (
                <span>{row.code}</span>
              )}
            </DiagnosticSource>
          )}
        </ark.div>
        <DiagnosticActions>
          {row.link ? (
            <Button asChild size="sm" variant="outline">
              <a href={row.link.href}>{row.link.label}</a>
            </Button>
          ) : null}
          {actions}
          {/* Named by its row: a list of six problems was six buttons all called "Details". */}
          {more ? <DiagnosticTrigger aria-label={t.details(row.title)} /> : null}
        </DiagnosticActions>
      </DiagnosticHeader>
      <DiagnosticContent>
        {row.detail ? (
          <DiagnosticDescription className="whitespace-pre-wrap">{row.detail}</DiagnosticDescription>
        ) : null}
        {row.help ? <DiagnosticDescription>{row.help}</DiagnosticDescription> : null}
        {row.children.length > 0 ? (
          <DiagnosticList>
            {row.children.map((child, i) => (
              <Item key={i} row={child} t={t} />
            ))}
          </DiagnosticList>
        ) : null}
      </DiagnosticContent>
    </Diagnostic>
  );
}

export interface ProblemProps extends Omit<DiagnosticProps, "variant" | "children"> {
  /** What was thrown, whatever it is. */
  error: unknown;
  /**
   * The host's words for a code, given the error's `data`; `undefined` keeps the error's own. Called
   * for the error and for every coded cause under it.
   */
  copy?: (code: string, data: unknown) => ProblemCopy | undefined;
  /** Beside the problem's own link and details trigger: a retry, a "go to". */
  children?: React.ReactNode;
  translations?: Partial<ProblemTranslations>;
}

/**
 * **A failure, as one `Diagnostic`** — a library's coded error, a server's refusal, the browser's
 * own `TypeError`, a string somebody threw. It reads the fields every coded error here shares:
 * `code` (`area/kind`, drawn as the source and kept on `data-code`), `title`, `message` (the detail)
 * and `data`, which only `copy` reads; and, when present, `severity`, `help` and `related`. `cause`
 * is walked as a tree below it, each cause read the same way, and `related` rows sit beside the
 * cause. A value that is not an object is its own `String`.
 *
 * It is a list item: put it in a `DiagnosticList`, alone or beside other rows. It is open at rest,
 * because a failure on screen is there to be read; `defaultOpen` and `open` pass through.
 */
export const Problem = (props: ProblemProps) => {
  const { error, copy, children, translations, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const row = read(error, copy, new Set(), 0);
  return <Item actions={children} root={{ defaultOpen: true, ...rest }} row={row} t={t} />;
};
