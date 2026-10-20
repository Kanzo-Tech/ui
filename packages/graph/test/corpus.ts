import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachFixture, connection as conn, queryable } from "@kanzo-tech/fixtures";
import { afterAll } from "vitest";
import { decodeIPC } from "@uwdata/mosaic-core";
import { Coordinator } from "@kanzo-tech/mosaic";
import { internalEngineOver, type Engine } from "@kanzo-tech/mosaic/engine";

/**
 * **The toy graph, attached the way a page attaches one**: `@kanzo-tech/fixtures`' `toy`, which
 * fossil's executor wrote from its sample, attached by `@kanzo-tech/graphar-duckdb`'s `attachGraph`
 * in a real DuckDB-WASM in this process, and read through an engine with a real Mosaic `Coordinator`
 * inside — so what the graph's SQL means is what DuckDB answers, and what its footers say is what
 * the writer counted. Small enough to count by hand, in global ids (fossil numbers the types in the
 * program's order, and the rows in the sample's):
 *
 * - `Person`: ids `0 … 9`, `subject` its primary key, `name` `Person i`, `team = i % 4`,
 *   `score = i + 1`, `lon = i`, `lat = 0`, `born = 1900 + i`, and `nickname`, a set of strings holding
 *   `nick i` — a multi-valued property is a list of the type that owns it.
 * - `Place`: ids `10 … 15`, `name` `Place i`, `lon = i`, `lat = 1`, `opened` the first of January of
 *   `2000 + i`, a GraphAr `date`.
 * - `Tag`: ids `16 … 19`, its `subject` and nothing else.
 * - `Person_knows_Person` links `i → i + 1` (9); `Person_livesIn_Place` links `i → 10 + i % 6` (10);
 *   `Person_tagged_Tag` links `0 → 16` (1).
 *
 * A test that needs a chunk with a footer of its own writes it with {@link writeChunk}, on the same
 * engine, so the footer a reader parses is DuckDB's own.
 */
const STATS_KEY = "fossil:stats";
/** Where a test's own chunks are written: DuckDB-WASM's Node runtime writes through the file system, so not the working directory. */
const chunks = mkdtempSync(join(tmpdir(), "graph-chunks-"));
afterAll(() => rmSync(chunks, { force: true, recursive: true }));
/**
 * Write `type`'s rows of the catalog `from` as the Parquet chunk `file`, stating `stats` under the
 * writer's key, or nothing when it is `null`.
 */
export function writeChunk(file: string, from: string, type: string, stats: string | null): void {
  const kv = stats === null ? "" : `, KV_METADATA {'${STATS_KEY}': '${stats.replace(/'/g, "''")}'}`;
  conn.query(`COPY (SELECT * FROM ${from}."${type}") TO '${file}' (FORMAT parquet, COMPRESSION zstd${kv});`);
}

export interface Attached {
  /**
   * The page's engine over this process's DuckDB: `query` and the coordinator inside it share one
   * connector, so `sent` sees both doors. The blocking connection answers before an abort could land,
   * so `query` reads the signal either side of the statement.
   */
  readonly engine: Engine;
  /** The coordinator inside `engine`, for a test that connects Mosaic clients of its own, as a chart would. */
  readonly coordinator: Coordinator;
  /** The catalog the graph is attached under — what `from` names. */
  readonly from: string;
  /** Every statement the engine sent, through either door, in order. */
  readonly sent: string[];
  /** How many of them have been answered, or refused. */
  readonly answered: { readonly count: number };
  /** How many queries the engine was asked, through either door, and how many of those have settled. */
  readonly asked: { readonly count: number; readonly settled: number };
  /** Make the next statement matching `pattern` fail with `error`, as a storage refusal would. */
  refuse(pattern: RegExp, error: unknown): void;
}

/** A chunk of `type` of the catalog `c` that a test writes itself: a name no writer's chunk has. */
export const chunkOf = (c: string, type: string, k = 0) => join(chunks, `${c}_${type}_chunk${k}.parquet`);

/** The first vertex chunk the writer wrote for `type`, as the catalog `c` lists it. */
export const writtenChunkOf = (c: string, type: string): string =>
  String(conn.query(`SELECT path FROM ${c}.graphar_chunks WHERE type = '${type}' AND kind = 'vertex' ORDER BY path LIMIT 1`).toArray()[0]!.path);

/** A fresh catalog holding the toy graph, and an engine of its own over the shared database. */
export async function attach(): Promise<Attached> {
  const { catalog: from } = await attachFixture("toy", queryable());
  const sent: string[] = [];
  const answered = { count: 0 };
  const refusals: { pattern: RegExp; error: unknown }[] = [];
  const connector = {
    async query(request: { type?: string; sql: string }) {
      sent.push(request.sql);
      try {
        return await answer(request);
      } finally {
        answered.count++;
      }
    },
  };
  async function answer({ type, sql }: { type?: string; sql: string }) {
    {
      // A turn of the event loop, as a worker's answer takes: nothing here answers synchronously.
      await new Promise((next) => setTimeout(next, 0));
      const refused = refusals.findIndex((r) => r.pattern.test(sql));
      if (refused >= 0) throw refusals.splice(refused, 1)[0]?.error;
      if (type === "exec") {
        conn.query(sql);
        return undefined;
      }
      // A connector answers Arrow as IPC bytes, which mosaic-core decodes itself (from 0.30).
      const bytes = conn.useUnsafe((bindings, id) => bindings.runQuery(id, sql));
      return type === "json" ? decodeIPC(bytes).toArray() : bytes;
    }
  }
  const coordinator = new Coordinator(connector as never, { logger: null });
  // Mosaic consolidates a query on the next animation frame before the connector sees it, so the
  // connector alone cannot tell a quiet from a frame that has not run yet: count at the manager too.
  const asked = { count: 0, settled: 0 };
  const request = coordinator.manager.request.bind(coordinator.manager);
  coordinator.manager.request = (entry, priority) => {
    asked.count++;
    const result = request(entry, priority);
    const settled = () => void asked.settled++;
    result.then(settled, settled);
    return result;
  };
  const query: Engine["query"] = async (sql, { signal }) => {
    asked.count++;
    try {
      signal.throwIfAborted();
      const bytes = (await connector.query({ type: "arrow", sql })) as Uint8Array;
      signal.throwIfAborted();
      return decodeIPC(bytes) as never;
    } finally {
      asked.settled++;
    }
  };
  const unused = () => Promise.reject(new Error("the corpus registers no files"));
  const engine = internalEngineOver({ query, registerFiles: unused, registerFileBuffer: unused, dropFiles: unused }, coordinator);
  return { engine, coordinator, from, sent, answered, asked, refuse: (pattern, error) => refusals.push({ pattern, error }) };
}

/** What a host's storage rejects with: an `Error` carrying a code. */
export const refusal = () => Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });

/**
 * Until every query asked of the engine has settled, every statement sent has been answered, and
 * nothing new was asked for a few turns — counted, not timed, so a slow runner waits for the answer
 * rather than for a quiet that came too early. Counting at the manager is what covers a query still
 * waiting on its frame, which the connector has not seen yet.
 */
export async function settle(attached: Attached): Promise<void> {
  let seen = -1;
  for (let quiet = 0, round = 0; quiet < 4 && round < 2000; round++) {
    await new Promise((next) => setTimeout(next, 5));
    const { asked, answered, sent } = attached;
    const done = asked.settled === asked.count && answered.count === sent.length;
    quiet = done && asked.count === seen ? quiet + 1 : 0;
    seen = asked.count;
  }
}

/**
 * `Person` grown to `people` rows, for a test about scale: the writer's ten, then more of the same
 * shape, the other types' global ids shifted after them. No checked-in sample holds a graph this size,
 * and fossil takes about 25 s to write one of 327,000 people (4.8 MB), so the rows past the writer's
 * are stated here; their footers stay the writer's ten.
 */
export async function grow(attached: Attached, people: number): Promise<Attached> {
  const c = attached.from;
  conn.query(`ALTER VIEW ${c}."Person" RENAME TO person_written;
    CREATE VIEW ${c}."Person" AS SELECT * FROM ${c}.person_written UNION ALL
      SELECT i AS _graphArVertexIndex, 'https://example.org/person/' || i AS subject, 'Person ' || i AS name, i % 4 AS team,
        i + 1 AS score, i::DOUBLE AS lon, 0::DOUBLE AS lat, 1900 + i AS born, ['nick ' || i] AS nickname
      FROM range(10, ${people}) t(i);
    ALTER VIEW ${c}.graphar_vertex_types RENAME TO types_written;
    CREATE VIEW ${c}.graphar_vertex_types AS
      SELECT * REPLACE (CASE WHEN type = 'Person' THEN ${people}::UBIGINT ELSE count END AS count) FROM ${c}.types_written;`);
  return attached;
}
