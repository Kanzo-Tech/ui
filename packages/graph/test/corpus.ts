import { attachFixture, connection as conn } from "@kanzo-tech/fixtures";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { decodeIPC } from "@uwdata/mosaic-core";
import { Coordinator, asTableRef, verbatim, type Relation } from "@kanzo-tech/mosaic";
import { internalEngineOver, type Engine } from "@kanzo-tech/mosaic/engine";

/**
 * **The toy graph, attached the way a page attaches one**: `@kanzo-tech/fixtures`' `toy`, which
 * fossil's executor wrote from its sample, attached by `@kanzo-tech/graphar-duckdb`'s `attachGraph`
 * through the test's own engine, in a real DuckDB-WASM in this process, with a real Mosaic
 * `Coordinator` inside — so what the graph's SQL means is what DuckDB answers, and what its
 * statistics say is what the writer's chunks state. Small enough to count by hand, in global ids
 * (the types in the graph's order, and the rows in the sample's):
 *
 * - `Person`: ids `0 … 9`, `subject` its primary key, `name` `Person i`, `team = i % 4`,
 *   `score = i + 1`, `lon = i`, `lat = 0`, `born = 1900 + i`, and `nickname`, a set of strings holding
 *   `nick i` — a multi-valued property is a list of the type that owns it.
 * - `Place`: ids `10 … 15`, `name` `Place i`, `lon = i`, `lat = 1`, `opened` the first of January of
 *   `2000 + i`, a GraphAr `date`.
 * - `Tag`: ids `16 … 19`, its `subject` and nothing else.
 * - `Person_knows_Person` links `i → i + 1` (9); `Person_livesIn_Place` links `i → 10 + i % 6` (10);
 *   `Person_tagged_Tag` links `0 → 16` (1).
 */
export interface Attached {
  /**
   * The page's engine over this process's DuckDB: `query` and the coordinator inside it share one
   * connector, so `sent` sees both doors. The blocking connection answers before an abort could land,
   * so `query` reads the signal either side of the statement.
   */
  readonly engine: Engine;
  /** The coordinator inside `engine`, for a test that connects Mosaic clients of its own, as a chart would. */
  readonly coordinator: Coordinator;
  /** The graph, as `attachGraph` answers it: attached through `engine`, so its reads are in `sent` too. */
  readonly graph: Graph;
  /** Every statement the engine sent, through either door, in order. */
  readonly sent: string[];
  /** How many of them have been answered, or refused. */
  readonly answered: { readonly count: number };
  /** How many queries the engine was asked, through either door, and how many of those have settled. */
  readonly asked: { readonly count: number; readonly settled: number };
  /** Make the next statement matching `pattern` fail with `error`, as a storage refusal would. */
  refuse(pattern: RegExp, error: unknown): void;
}

/** The toy graph under a fresh catalog, attached through an engine of its own over the shared database. */
export async function attach(): Promise<Attached> {
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
  const graph = await attachFixture("toy", engine);
  return { engine, coordinator, graph, sent, answered, asked, refuse: (pattern, error) => refusals.push({ pattern, error }) };
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

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * `Person` grown to `people` rows, for a test about scale: the writer's ten, then more of the same
 * shape, the other types' global ids shifted after them. No checked-in sample holds a graph this size,
 * and fossil takes about 25 s to write one of 327,000 people (4.8 MB), so the rows past the writer's
 * are stated here: the type's relation, as the `Graph` names it, is replaced by one that holds them,
 * and the `Graph` answered says so in its count. Its statistics stay the writer's ten.
 */
export function grow(attached: Attached, people: number): Attached {
  const { graph } = attached;
  const person = graph.vertexTypes.find((t) => t.type === "Person")!;
  const grown: Record<string, string> = {
    subject: "'https://example.org/person/' || i",
    name: "'Person ' || i",
    team: "i % 4",
    score: "i + 1",
    lon: "i::DOUBLE",
    lat: "0::DOUBLE",
    born: "1900 + i",
    nickname: "['nick ' || i]",
  };
  const columns = [person.index, ...person.properties.map((p) => p.name)];
  const written = person.table.replace(/"[^"]*"$/, ident("person_written"));
  conn.query(`ALTER VIEW ${person.table} RENAME TO ${ident("person_written")};
    CREATE VIEW ${person.table} AS SELECT ${columns.map(ident).join(", ")} FROM ${written} UNION ALL
      SELECT i AS ${ident(person.index)}, ${person.properties.map((p) => `${grown[p.name]} AS ${ident(p.name)}`).join(", ")}
      FROM range(10, ${people}) t(i);`);
  const vertexTypes = graph.vertexTypes.map((t) => (t === person ? { ...t, count: people } : t));
  return { ...attached, graph: { ...graph, vertexTypes } };
}

/**
 * **Every vertex under its global id, written by hand**: each type's rows from the relation the
 * `Graph` names, its index offset by the counts of the types before it, in the graph's order — the
 * oracle a test holds the store's `dense_id` to, so it is not the store's own union. `columns` are
 * read where the type has the property and are NULL where it does not.
 */
export function globalRows(graph: Graph, columns: readonly string[] = []): string {
  let first = 0;
  return graph.vertexTypes
    .map((t) => {
      const has = new Set(t.properties.map((p) => p.name));
      const read = columns.map((c) => (has.has(c) ? `${ident(c)}` : `NULL AS ${ident(c)}`));
      const branch = `SELECT ${first} + ${ident(t.index)} AS dense_id${read.map((r) => `, ${r}`).join("")} FROM ${t.table}`;
      first += t.count;
      return branch;
    })
    .join(" UNION ALL ");
}

/**
 * **One type's relation as a table Mosaic can trace**: the type's rows as the `Graph` names them, its
 * index the one vertex they carry. A pattern's relation is `graph.match`'s SQL text, which Mosaic's
 * pre-aggregator cannot follow to a base table, so a test about pre-aggregation reads the table itself.
 */
export function typeRelation(graph: Graph, type: string): Relation {
  const of = graph.vertexTypes.find((t) => t.type === type)!;
  const parts = [...of.table.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]!.replace(/""/g, '"'));
  const vertex = { type, index: verbatim(ident(of.index)) };
  return { key: `type:${type}`, table: asTableRef(parts)!, vertices: [vertex], roots: [vertex] };
}
