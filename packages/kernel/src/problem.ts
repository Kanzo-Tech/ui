import { PROBLEMS, TYPE_BASE, type ProblemDataMap } from "./problems.gen.js";

/** A registered code. */
export type ProblemCode = keyof ProblemDataMap;
/** The `data` of a code: its registered fields, or free JSON for a code a host owns. */
export type ProblemData<C extends string = string> = C extends ProblemCode ? ProblemDataMap[C] : Readonly<Record<string, unknown>>;
/** `data` is a required argument exactly when the registry declares a required field. */
type Rest<C extends string> = Record<string, never> extends ProblemData<C> ? [data?: ProblemData<C>, options?: ProblemOptions] : [data: ProblemData<C>, options?: ProblemOptions];

/** The wire: `application/problem+json` (RFC 9457); `code` and the rest are extension members (§3.2). */
export interface ProblemBody {
  readonly type: string;
  readonly status?: number;
  readonly title: string;
  readonly detail: string;
  readonly code: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly help?: string;
  readonly severity?: "error" | "warning" | "info";
  readonly related?: readonly ProblemBody[];
  readonly cause?: ProblemBody;
}

export interface ProblemOptions {
  readonly status?: number;
  /** A host's own code only: a registered code's title is the registry's (§3.1.3, one per type). */
  readonly title?: string;
  readonly help?: string;
  readonly severity?: "error" | "warning" | "info";
  readonly related?: readonly Problem[];
  /** Whatever was caught, kept as it came; it reaches the wire only when it is itself a Problem. */
  readonly cause?: unknown;
}

/** Nesting `cause` and `related` are followed this deep, and no deeper, on the wire and off it. */
const DEPTH = 8;
const SEVERITIES = ["error", "warning", "info"];
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

const CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** True of an `area/kind` code, the grammar a host branches on. */
export function isCode(value: unknown): value is string {
  return typeof value === "string" && CODE.test(value);
}

/**
 * True of anything with a string `message` and a code in the grammar: a `FossilError`, a Problem
 * rebuilt from a `postMessage`, a second copy of this package. Never `instanceof`: two copies of a
 * class are two classes.
 */
export function isProblem<C extends string>(value: unknown, code: C): value is Problem<C>;
export function isProblem(value: unknown): value is Problem;
export function isProblem(value: unknown, code?: string): boolean {
  if (typeof value !== "object" || value === null) return false;
  const { message, code: own } = value as { message?: unknown; code?: unknown };
  return typeof message === "string" && isCode(own) && (code === undefined || own === code);
}

/**
 * The wire body of anything `isProblem`; reads fields and never serialises the object. What is not
 * this copy's own `Problem` is foreign (a `FossilError`, a second copy): its `data` keeps only the
 * fields the registry declares for its code and none for a code the registry lacks, because it is
 * the author of those members and not us. A cause or related member already on `path` (a cycle) or
 * past `DEPTH` is left out; RFC 9457 is silent on both, and `Error.cause` allows a cycle.
 */
function bodyOf(p: Problem, path: readonly object[] = []): ProblemBody {
  const { status, message, code, data, help, severity, related, cause } = p;
  const row = (PROBLEMS as Record<string, (typeof PROBLEMS)[ProblemCode] | undefined>)[code];
  const own = p instanceof Problem;
  const kept = own ? data : Object.fromEntries(Object.entries(data ?? {}).filter(([k, v]) => typeof v === row?.data[k]));
  const below = [...path, p];
  const nest = (q: unknown) => (isProblem(q) && below.length < DEPTH && !below.includes(q) ? bodyOf(q, below) : undefined);
  return {
    type: TYPE_BASE + code,
    status: num(status),
    title: row?.title ?? str(p.title) ?? code,
    detail: message,
    code,
    data: kept,
    help: str(help),
    severity: SEVERITIES.includes(severity) ? severity : undefined,
    related: related?.map(nest).filter((b) => b !== undefined),
    // A foreign (non-Problem) cause carries statements, URLs with credentials, paths and a stack: it stays in process.
    cause: nest(cause),
  };
}

/** The one failure: RFC 9457's object, `code` its discriminator. `message` is the RFC's `detail`. */
export class Problem<C extends string = string> extends Error {
  override readonly name = "Problem";
  /** Derived from `code`, never independent: the RFC's primary identifier (§3.1.1). */
  readonly type: string;
  readonly title: string;
  readonly status?: number;
  readonly help?: string;
  readonly severity: "error" | "warning" | "info";
  readonly related?: readonly Problem[];
  readonly code: C;
  readonly data: ProblemData<C>;

  constructor(code: C, message: string, ...rest: Rest<C>) {
    const [data = {}, options = {}] = rest as [ProblemData<C>?, ProblemOptions?];
    super(message, "cause" in options ? { cause: options.cause } : undefined);
    const row = (PROBLEMS as Record<string, (typeof PROBLEMS)[ProblemCode] | undefined>)[code];
    this.code = code;
    this.data = data as ProblemData<C>;
    this.type = TYPE_BASE + code;
    this.status = options.status ?? row?.status;
    this.title = row?.title ?? options.title ?? code;
    this.help = options.help;
    this.severity = options.severity ?? "error";
    this.related = options.related;
  }

  /** `application/problem+json`. A `cause` is present only if it is itself a Problem; never a stack. */
  toJSON(): ProblemBody {
    return bodyOf(this);
  }

  /**
   * Rebuild across a worker or a response. A member of the wrong type is ignored, as RFC 9457 §3.1
   * asks; `type` is ignored because it is derived from `code`; unknown members are ignored (§3.2).
   */
  static from(body: ProblemBody): Problem {
    return rebuild(body, 0);
  }
}

function rebuild(body: ProblemBody, depth: number): Problem {
  const deeper = (b: ProblemBody) => (depth + 1 < DEPTH ? rebuild(b, depth + 1) : undefined);
  const data = typeof body.data === "object" && body.data !== null ? { ...body.data } : {};
  return new Problem(body.code, str(body.detail) ?? "", data as never, {
    status: num(body.status),
    title: str(body.title),
    help: str(body.help),
    severity: SEVERITIES.includes(body.severity as string) ? body.severity : undefined,
    related: Array.isArray(body.related) ? body.related.map(deeper).filter((p) => p !== undefined) : undefined,
    cause: body.cause && deeper(body.cause),
  });
}
