import type { Batch, Corpus, Filter, Literal, Manifest, ScanParams, ScanTask } from "@fossil-lang/corpus";

/**
 * A `fossil/1` corpus in memory, small enough to count by hand, answering the contract's `scan`.
 *
 * - `Person`, laid out: ids `0 … 9` at `(i, 0)`, `cluster_id = i % 4`, `degree = i + 1`.
 * - `Place`, placed by the program's `lon`/`lat`: ids `10 … 15` at `(i, 1)`.
 * - `Tag`, no position: ids `16 … 19`, never drawn.
 * - `Person_knows_Person` links `i → i + 1`; `Person_livesIn_Place` links `i → 10 + i % 6`; and
 *   `Person_tagged_Tag`, whose far end is not drawn, is never read.
 *
 * Reads are recorded and held until the test releases them, so a test can see what is in flight and
 * what was aborted.
 */
export interface Read {
  readonly params: ScanParams;
  readonly signal?: AbortSignal;
  released: boolean;
  release(): void;
  /** Fail the read with `error`, as fossil's `scan.read` rejects. */
  reject(error: unknown): void;
}

export interface FakeCorpus {
  readonly corpus: Corpus;
  readonly reads: Read[];
  /** Resolve every held read, repeatedly, until nothing is left in flight. */
  settle(): Promise<void>;
  /** Scans built, with their params — a new scan is a new question. */
  readonly scans: ScanParams[];
}

type Row = Record<string, Literal | null>;

const people: Row[] = Array.from({ length: 10 }, (_, i) => ({
  dense_id: i,
  subject: `https://example.org/person/${i}`,
  x: i,
  y: 0,
  cluster_id: i % 4,
  degree: i + 1,
}));
const places: Row[] = Array.from({ length: 6 }, (_, i) => ({
  dense_id: 10 + i,
  subject: `https://example.org/place/${i}`,
  name: `Place ${i}`,
  lon: i,
  lat: 1,
  degree: 1,
}));
const tags: Row[] = Array.from({ length: 4 }, (_, i) => ({ dense_id: 16 + i, subject: `https://example.org/tag/${i}` }));
const knows: Row[] = Array.from({ length: 9 }, (_, i) => ({ src: i, dst: i + 1 }));
const livesIn: Row[] = Array.from({ length: 10 }, (_, i) => ({ src: i, dst: 10 + (i % 6) }));
const tagged: Row[] = [{ src: 0, dst: 16 }];

const ROWS: Record<string, Row[]> = {
  Person: people,
  Place: places,
  Tag: tags,
  Person_knows_Person: knows,
  Person_livesIn_Place: livesIn,
  Person_tagged_Tag: tagged,
};

const prop = (name: string, type: string) => ({ name, type });
const edge = (name: string, label: string, src: string, dst: string, count: number) => ({
  name,
  label,
  path: `edge/${name}.parquet`,
  source: { key: "src", references: src },
  destination: { key: "dst", references: dst },
  record_count: count,
  properties: [prop("src", "uint32"), prop("dst", "uint32")],
});

export const MANIFEST: Manifest = {
  format: "fossil/1",
  vertex_tables: [
    {
      name: "Person",
      path: "vertex/Person.parquet",
      key: "dense_id",
      identity: "subject",
      record_count: people.length,
      properties: [
        prop("dense_id", "uint32"),
        prop("subject", "string"),
        prop("x", "float"),
        prop("y", "float"),
        prop("cluster_id", "uint32"),
        prop("degree", "int32"),
      ],
      position: { by: "layout", x: "x", y: "y" },
    },
    {
      name: "Place",
      path: "vertex/Place.parquet",
      key: "dense_id",
      identity: "subject",
      record_count: places.length,
      properties: [
        prop("dense_id", "uint32"),
        prop("subject", "string"),
        prop("name", "string"),
        prop("lon", "double"),
        prop("lat", "double"),
        prop("degree", "int32"),
      ],
      position: { by: "program", x: "lon", y: "lat" },
    },
    {
      name: "Tag",
      path: "vertex/Tag.parquet",
      key: "dense_id",
      identity: "subject",
      record_count: tags.length,
      properties: [prop("dense_id", "uint32"), prop("subject", "string")],
    },
  ],
  edge_tables: [
    edge("Person_knows_Person", "knows", "Person", "Person", knows.length),
    edge("Person_livesIn_Place", "livesIn", "Person", "Place", livesIn.length),
    edge("Person_tagged_Tag", "tagged", "Person", "Tag", tagged.length),
  ],
};

function compare(value: Literal | null, op: string, literal: Literal): boolean {
  if (value === null) return false;
  switch (op) {
    case "=":
      return value === literal;
    case "!=":
      return value !== literal;
    case "<":
      return value < literal;
    case "<=":
      return value <= literal;
    case ">":
      return value > literal;
    default:
      return value >= literal;
  }
}

/** The contract's `Filter`, evaluated as SQL would: a comparison with a null is not a match. */
function matches(row: Row, filter: Filter): boolean {
  if ("and" in filter) return filter.and.every((f) => matches(row, f));
  if ("or" in filter) return filter.or.some((f) => matches(row, f));
  if ("not" in filter) return !matches(row, filter.not);
  if ("bbox" in filter) return true;
  const value = row[filter.column] ?? null;
  if (!("value" in filter) && !("values" in filter)) return (value === null) === (filter.op === "is null");
  if ("values" in filter) return value !== null && filter.values.includes(value) === (filter.op === "in");
  return compare(value, filter.op, filter.value);
}

function batchOf(rows: readonly Row[], columns: readonly string[]): Batch {
  return {
    numRows: rows.length,
    getChild: (name) => (columns.includes(name) ? { toArray: () => rows.map((row) => row[name] ?? null) } : null),
  };
}

export function fakeCorpus(manifest: Manifest = MANIFEST): FakeCorpus {
  const reads: Read[] = [];
  const scans: ScanParams[] = [];

  const held = <T>(read: Omit<Read, "release" | "released" | "reject">, answer: () => T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(read.signal?.reason ?? new DOMException("aborted", "AbortError"));
      if (read.signal?.aborted) return onAbort();
      read.signal?.addEventListener("abort", onAbort, { once: true });
      const entry: Read = {
        ...read,
        released: false,
        release: () => {
          entry.released = true;
          resolve(answer());
        },
        reject: (error) => {
          entry.released = true;
          reject(error);
        },
      };
      reads.push(entry);
    });

  const corpus: Corpus = {
    url: "fake://corpus",
    manifest,
    scan(params) {
      const rows = ROWS[params.table];
      const table = [...manifest.vertex_tables, ...manifest.edge_tables].find((t) => t.name === params.table);
      if (!rows || !table) throw new Error(`${params.table} is not a table of this corpus`);
      // fossil refuses a column the manifest does not declare, before any statement runs.
      for (const column of params.select ?? []) {
        if (!table.properties.some((p) => p.name === column)) throw new Error(`select names ${column}, which ${table.name} does not declare`);
      }
      scans.push(params);
      const columns = params.select ?? Object.keys(rows[0] ?? {});
      const plan = (): ScanTask[] => [{ table: params.table, path: `${params.table}.parquet`, rows: rows.length }];
      const read = (_tasks: readonly ScanTask[], options: { signal?: AbortSignal } = {}) =>
        held({ params, signal: options.signal }, () => {
          const kept = rows.filter((row) => params.filter === undefined || matches(row, params.filter));
          return [batchOf(kept.slice(0, params.limit ?? kept.length), columns)];
        });
      return { params, plan, read };
    },
    close: () => Promise.resolve(),
  };

  return {
    corpus,
    reads,
    scans,
    async settle() {
      const open = () => reads.filter((read) => !read.released && !read.signal?.aborted);
      for (let round = 0; round < 100; round++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const waiting = open();
        if (waiting.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (open().length === 0) return;
          continue;
        }
        for (const read of waiting) read.release();
      }
    },
  };
}
