import { PHRASES, PROBLEMS, type ProblemDataMap } from "./problems.gen.js";

/** A registered code. */
export type ProblemCode = keyof ProblemDataMap;
/** The `data` of a code: its registered fields, or free JSON for a code a host owns. */
export type ProblemData<C extends string = string> = C extends ProblemCode ? ProblemDataMap[C] : Record<string, unknown>;

/** The wire: `application/problem+json` (RFC 9457) with `code` and `data` as extension members. */
export interface ProblemBody {
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
  readonly title?: string;
  readonly help?: string;
  readonly severity?: "error" | "warning" | "info";
  readonly related?: readonly Problem[];
  /** Whatever was caught, kept as it came; it reaches the wire only when it is itself a Problem. */
  readonly cause?: unknown;
}

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

/** The wire body of anything `isProblem`; reads fields and never serialises the object. */
function bodyOf(p: Problem): ProblemBody {
  const { status, title, message, code, data, help, severity, related, cause } = p;
  return {
    status,
    title: (status !== undefined && PHRASES[status]) || title || code,
    detail: message,
    code,
    data,
    help,
    severity,
    related: related?.map(bodyOf),
    // A foreign cause carries statements, URLs with credentials, paths and a stack: it stays in process.
    cause: isProblem(cause) ? bodyOf(cause) : undefined,
  };
}

/** The one failure: RFC 9457's object, `code` its discriminator. `message` is the RFC's `detail`. */
export class Problem<C extends string = string> extends Error {
  override readonly name = "Problem";
  readonly title: string;
  readonly status?: number;
  readonly help?: string;
  readonly severity: "error" | "warning" | "info";
  readonly related?: readonly Problem[];

  constructor(
    readonly code: C,
    message: string,
    readonly data: ProblemData<C> = {} as ProblemData<C>,
    options: ProblemOptions = {},
  ) {
    super(message, "cause" in options ? { cause: options.cause } : undefined);
    const row = (PROBLEMS as Record<string, { status?: number; title: string } | undefined>)[code];
    this.status = options.status ?? row?.status;
    this.title = options.title ?? row?.title ?? code;
    this.help = options.help;
    this.severity = options.severity ?? "error";
    this.related = options.related;
  }

  /** `application/problem+json`. A `cause` is present only if it is itself a Problem; never a stack. */
  toJSON(): ProblemBody {
    return bodyOf(this);
  }

  /** Rebuild across a worker or a response: the registry's title, unless the code is a host's own. */
  static from(body: ProblemBody): Problem {
    return new Problem(body.code, body.detail, { ...body.data }, {
      status: body.status,
      title: body.code in PROBLEMS ? undefined : body.title,
      help: body.help,
      severity: body.severity,
      related: body.related?.map(Problem.from),
      cause: body.cause && Problem.from(body.cause),
    });
  }
}
