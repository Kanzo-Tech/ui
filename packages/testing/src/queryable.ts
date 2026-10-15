/**
 * The read side of an engine, as much of it as the family's readers use: a statement in, columns out.
 * Structural, so Arrow JS, flechette and a fake all satisfy it; a reader that needs less takes less.
 */
export interface Queryable {
  query(sql: string, options: { readonly signal: AbortSignal }): Promise<QueryableTable>;
}

/** The part of apache-arrow's `Table` a reader reads. */
export interface QueryableTable {
  readonly numRows: number;
  readonly schema: { readonly fields: readonly { readonly name: string }[] };
  getChild(name: string): { readonly length: number; get(index: number): unknown } | null;
}

/** What a conformance case runs against, made fresh for each case. */
export interface QueryableUnderTest {
  readonly queryable: Queryable;
  /**
   * Kills the engine the way it dies in a page, for the case that asserts `engine/lost`: the worker
   * going away under a statement. Required unless the kit is told `dies: false`.
   */
  readonly kill?: () => void | Promise<void>;
}

/** One assertion of the kit, to be registered as a test by whatever runs it. */
export interface ConformanceCase {
  readonly name: string;
  run(): Promise<void>;
}

export interface ConformanceOptions {
  /**
   * Whether the engine interrupts a running statement. `false` states that it cannot: the kit then
   * asserts that it refuses a statement handed a signal with `engine/cannot-cancel`, at the call,
   * rather than accepting the signal and ignoring it. Default `true`.
   */
  readonly cancels?: boolean;
  /** Whether the engine can die after it started, and `kill` can make it. Default `true`. */
  readonly dies?: boolean;
}

/** Far longer than any case waits: it ends only if the engine interrupts it, or dies. */
const LONG = "SELECT sum(i * i) FROM range(1000000000) t(i)";

/** After an abort, the connection must answer a trivial statement within this many milliseconds. */
const RECOVERS_WITHIN = 200;

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`queryable conformance: ${message}`);
}

const settle = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    (value) => ({ resolved: value }),
    (error: unknown) => ({ rejected: error }),
  );

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  const result = (await settle(promise)) as { resolved?: unknown; rejected?: unknown };
  assert("rejected" in result, "a statement that should have been refused resolved");
  return result.rejected;
};

const codeOf = (error: unknown) => (error as { code?: unknown } | null)?.code;

/** Everything a thrown value holds, so a literal cannot hide in a `cause` or a `data`. */
const everything = (error: unknown) => JSON.stringify(error, Object.getOwnPropertyNames(error as object));

const pause = (ms: number) => new Promise<void>((next) => setTimeout(next, ms));

/**
 * What every engine and every double of one passes, as cases for the test runner at hand (`it(name,
 * run)` for each). The kit asserts what an engine does and nothing about how a result is printed:
 *
 * - a statement returns columns the readers' subset reads (`numRows`, `schema.fields`, `getChild`),
 *   and SQL `NULL` reads as `null`;
 * - a refusal rejects `engine/failed`, and a literal of the statement is on no field of it;
 * - a signal aborted before the call rejects with its reason without the statement being sent;
 * - a signal aborted during a long statement rejects with its reason and leaves the connection
 *   answering a trivial statement within 200 ms (or, for `cancels: false`, the call is refused with
 *   `engine/cannot-cancel`);
 * - an engine that dies under a statement rejects it, and every later one, with `engine/lost`.
 *
 * The statements are DuckDB's. The reference is ADBC: its cancel interrupts execution and leaves the
 * connection usable, which is the second-to-last rule above in its own words.
 */
export function queryableConformance(
  make: () => Promise<QueryableUnderTest>,
  { cancels = true, dies = true }: ConformanceOptions = {},
): readonly ConformanceCase[] {
  const signal = () => new AbortController().signal;
  const cases: ConformanceCase[] = [
    {
      name: "answers in columns: numRows, schema.fields and getChild",
      async run() {
        const { queryable } = await make();
        const table = await queryable.query("SELECT 41 + 1 AS answer, 'x' AS letter", { signal: signal() });
        assert(table.numRows === 1, `numRows was ${table.numRows}`);
        assert(
          table.schema.fields.map((field) => field.name).join() === "answer,letter",
          "schema.fields did not name the columns in order",
        );
        const answer = table.getChild("answer");
        assert(answer?.length === 1 && answer.get(0) === 42, "getChild(name).get(0) did not read the value");
        // Arrow JS answers `null` and flechette `undefined`; every reader here reads it with `?.`.
        assert(table.getChild("missing") == null, "getChild of a name that is not a column was not null or undefined");
      },
    },
    {
      name: "reads SQL NULL as null",
      async run() {
        const { queryable } = await make();
        const table = await queryable.query("SELECT NULL::INTEGER AS nothing", { signal: signal() });
        assert(table.getChild("nothing")?.get(0) === null, "get(i) of a NULL was not null");
      },
    },
    {
      name: "rejects a refused statement as engine/failed, with no literal of it on the error",
      async run() {
        const { queryable } = await make();
        const failure = await rejection(
          queryable.query("SELECT * FROM nowhere_at_all WHERE name = 'kit-literal-ada' AND id IN (7421, 7422)", {
            signal: signal(),
          }),
        );
        assert(codeOf(failure) === "engine/failed", `the code was ${String(codeOf(failure))}`);
        assert(!/kit-literal-ada|7421|7422/.test(everything(failure)), "a literal of the statement was on the error");
      },
    },
    {
      name: "rejects a signal aborted before the call, with its reason, without sending the statement",
      async run() {
        const { queryable } = await make();
        const controller = new AbortController();
        const reason = new Error("aborted before");
        controller.abort(reason);
        const failure = await rejection(
          queryable.query("CREATE TEMP TABLE kit_was_sent AS SELECT 1 AS one", { signal: controller.signal }),
        );
        assert(failure === reason, "the rejection was not the signal's reason");
        const probe = await rejection(queryable.query("SELECT * FROM kit_was_sent", { signal: signal() }));
        assert(codeOf(probe) === "engine/failed", "the statement of an aborted signal was sent");
      },
    },
  ];

  if (cancels) {
    cases.push({
      name: `interrupts a long statement on abort, and the next one answers within ${RECOVERS_WITHIN} ms`,
      async run() {
        const { queryable } = await make();
        const controller = new AbortController();
        const reason = new Error("stop");
        const long = queryable.query(LONG, { signal: controller.signal });
        await pause(100);
        controller.abort(reason);
        const failure = await rejection(long);
        assert(failure === reason, "the rejection was not the signal's reason");
        const from = performance.now();
        await queryable.query("SELECT 1 AS one", { signal: signal() });
        const took = performance.now() - from;
        assert(took < RECOVERS_WITHIN, `the next statement took ${took.toFixed(0)} ms: the abort did not stop the statement`);
      },
    });
  } else {
    cases.push({
      name: "refuses a statement handed a signal, with engine/cannot-cancel, instead of ignoring the signal",
      async run() {
        const { queryable } = await make();
        const failure = await rejection(queryable.query("SELECT 1 AS one", { signal: signal() }));
        assert(codeOf(failure) === "engine/cannot-cancel", `the code was ${String(codeOf(failure))}`);
      },
    });
  }

  if (dies) {
    cases.push({
      name: "rejects a statement the engine died under, and every later one, with engine/lost",
      async run() {
        const { queryable, kill } = await make();
        assert(kill, "the engine under test has no kill, and the kit was not told dies: false");
        const held = queryable.query(LONG, { signal: signal() });
        await pause(100);
        await kill();
        const failure = await rejection(held);
        assert(codeOf(failure) === "engine/lost", `the code was ${String(codeOf(failure))}`);
        const later = await rejection(queryable.query("SELECT 1 AS one", { signal: signal() }));
        assert(codeOf(later) === "engine/lost", `a later statement's code was ${String(codeOf(later))}`);
      },
    });
  }

  return cases;
}
