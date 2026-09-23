import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Coordinator } from "@kanzo-tech/mosaic";
import { openCorpus } from "./duck-source";

/**
 * Which relations a corpus' canvas reads — **the half of `openCorpus` that needs no network.**
 *
 * `duck-source.test.ts` beside this one says a stub connector cannot reach this module's SQL,
 * because `openCorpus` boots a WASM module before it builds a query and jsdom has no module. That
 * is true of a module nobody hands it and false of one somebody does: `@fossil-lang/corpus`'s own
 * tests read `fossil_graph_wasm_bg.wasm` off disk and pass the bytes as `wasmUrl`
 * (`packages/corpus/tests/boot.ts`), and the package ships that file. So the addressing here is
 * fossil's real addressing over manifests written out below, and the only thing stubbed is the
 * connector — which is what makes the SQL assertable.
 *
 * Two defects are what this file exists for, and a corpus of one edge label between one pair of
 * types hides both:
 *
 * - **A second edge label was dropped in silence.** The relation was picked with `.find` over the
 *   ones whose source is this type, so a corpus declaring `knows` and `works_with` registered a
 *   view over `knows` and drew `knows`, and nothing anywhere said the other existed.
 * - **A cross-type relation crossed `dense_id` spaces.** `dst_dense` on a `Person -placed-> Order`
 *   row numbers an Order; `dense_id` in the payload numbers a Person. Both are `BIGINT`, so the
 *   join that places a far end matched them and drew a line between two vertices that have no
 *   relation at all — undetectably, because the rows look like every other row.
 */

const WASM = readFileSync(
  resolve(process.cwd(), "node_modules/@fossil-lang/corpus/pkg/fossil_graph_wasm_bg.wasm"),
);

const BASE = "https://host.example/corpus";

/** One vertex type, tiled at 4,096 with one tile's worth of rows. */
const vertexManifest = (type: string) =>
  [
    `type: ${type}`,
    "vertex_count: 3",
    "chunk_size: 4096",
    `prefix: vertex/${type}/`,
    "projections:",
    "- path: ''",
    "  scale: 1",
    "  file_type: parquet",
    "version: gar/v1",
    "",
  ].join("\n");

/** One relation, publishing its source-ordered orientation and no level. */
const edgeManifest = (src: string, label: string, dst: string, orientations = ["src"]) =>
  [
    `src_type: ${src}`,
    `edge_type: ${label}`,
    `dst_type: ${dst}`,
    "chunk_size: 4096",
    "src_chunk_size: 4096",
    "dst_chunk_size: 4096",
    `prefix: edge/${src}_${label}_${dst}/`,
    "projections:",
    ...orientations.flatMap((aligned) => [
      `- path: by_${aligned === "src" ? "source" : "target"}/`,
      "  scale: 1",
      `  aligned_by: ${aligned}`,
      "  ordered: true",
      "  file_type: parquet",
    ]),
    "version: gar/v1",
    "",
  ].join("\n");

/**
 * A corpus, as the manifests fossil's `open` will ask for — and nothing else exists.
 *
 * No payload is written: every assertion below is about which URLs are composed, and a URL is
 * composed from the manifests alone. The connector never reaches one.
 */
function corpus(options: {
  types: string[];
  relations: Array<[string, string, string] | [string, string, string, string[]]>;
}) {
  const files: Record<string, string> = {
    "graph.graph.yml": [
      "name: graph",
      "prefix: ''",
      "container: files",
      "vertices:",
      ...options.types.map((type) => `- vertex/${type}.vertex.yml`),
      ...(options.relations.length === 0 ? [] : ["edges:"]),
      ...options.relations.map(([src, label, dst]) => `- edge/${src}_${label}_${dst}.edge.yml`),
      "version: gar/v1",
      "",
    ].join("\n"),
  };
  for (const type of options.types) files[`vertex/${type}.vertex.yml`] = vertexManifest(type);
  for (const [src, label, dst, orientations] of options.relations) {
    files[`edge/${src}_${label}_${dst}.edge.yml`] = edgeManifest(src, label, dst, orientations);
  }
  return files;
}

/**
 * Open one, with every statement the coordinator was asked to run kept in order.
 *
 * The footer read is answered with a single tile covering the whole plane, which is what makes
 * `slice` select tile 0 and compose the edge URLs this file is about. Everything else answers with
 * no rows: the assertions are over the SQL, never over what it would have returned.
 */
async function opening(files: Record<string, string>, vertexType?: string) {
  const asked: string[] = [];
  const connector = {
    query: ({ sql }: { sql: string }) => {
      asked.push(sql);
      return Promise.resolve(
        sql.includes("parquet_metadata") ? [{ tile: 0, x0: 0, x1: 10, y0: 0, y1: 10 }] : [],
      );
    },
  };
  const coordinator = new Coordinator(connector as never, {
    logger: null,
    consolidate: false,
    cache: false,
  });
  const opened = await openCorpus({
    coordinator,
    dest: BASE,
    vertexType,
    readText: async (url: string) => {
      const text = files[url.slice(`${BASE}/`.length)];
      if (text === undefined) throw new Error(`no manifest at ${url}`);
      return text;
    },
    wasmUrl: WASM as unknown as URL,
  });
  return { asked, opened };
}

/** The links half of a slice over the whole plane — the query that joins the two endpoints. */
async function linksSql(opened: { source: { slice: (r: never) => Promise<unknown> } }, asked: string[]) {
  await opened.source.slice({
    limit: 100,
    minLinkPixels: 0,
    view: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
  } as never);
  const links = asked.filter((sql) => sql.includes("FROM span sp"));
  expect(links).toHaveLength(1);
  return links[0] as string;
}

describe("the relations a corpus' canvas reads", () => {
  it("registers a view for every edge label between the drawn type and itself", async () => {
    const { asked, opened } = await opening(
      corpus({
        types: ["Person"],
        relations: [
          ["Person", "knows", "Person"],
          ["Person", "works_with", "Person"],
        ],
      }),
    );

    // Each over its own relation's files, and neither over the other's — one view registered here
    // is the defect: `works_with` had no name to be queried under and nothing said so.
    const views = asked.filter((sql) => sql.startsWith("CREATE OR REPLACE VIEW corpus_Person_"));
    expect(views).toHaveLength(2);
    expect(views[0]).toContain("edge/Person_knows_Person/by_source/chunk0.parquet");
    expect(views[1]).toContain("edge/Person_works_with_Person/by_source/chunk0.parquet");

    expect(opened.edges).toEqual([
      {
        edgeType: "knows",
        srcType: "Person",
        dstType: "Person",
        view: "corpus_Person_knows_Person",
      },
      {
        edgeType: "works_with",
        srcType: "Person",
        dstType: "Person",
        view: "corpus_Person_works_with_Person",
      },
    ]);
    expect(opened.undrawn).toEqual([]);
  });

  it("draws every label's tiles, not the first label's", async () => {
    const { asked, opened } = await opening(
      corpus({
        types: ["Person"],
        relations: [
          ["Person", "knows", "Person"],
          ["Person", "works_with", "Person"],
        ],
      }),
    );

    const links = await linksSql(opened, asked);
    expect(links).toContain("edge/Person_knows_Person/by_source/chunk0.parquet");
    expect(links).toContain("edge/Person_works_with_Person/by_source/chunk0.parquet");
  });

  it("never reads a relation whose far end is another type's dense_id space", async () => {
    const { asked, opened } = await opening(
      corpus({
        types: ["Person", "Order"],
        relations: [
          ["Person", "knows", "Person"],
          ["Person", "placed", "Order"],
        ],
      }),
    );

    // Not opened: its `dst_dense` would have joined against Person's `dense_id` and drawn a line
    // from a Person to whichever Person happens to wear the Order's number.
    const links = await linksSql(opened, asked);
    expect(links).toContain("edge/Person_knows_Person/by_source/chunk0.parquet");
    expect(links).not.toContain("Person_placed_Order");
    // Nor registered — a view over it is the same crossing one `JOIN` later.
    expect(asked.some((sql) => sql.includes("Person_placed_Order"))).toBe(false);

    expect(opened.edges.map((relation) => relation.view)).toEqual(["corpus_Person_knows_Person"]);
    expect(opened.undrawn).toEqual([
      { edgeType: "placed", srcType: "Person", dstType: "Order", reason: "other-space" },
    ]);
  });

  it("names the relation the drawn type is only the destination of", async () => {
    const { opened } = await opening(
      corpus({
        types: ["Person", "Order"],
        relations: [["Person", "placed", "Order"]],
      }),
      "Order",
    );

    expect(opened.edges).toEqual([]);
    expect(opened.undrawn).toEqual([
      { edgeType: "placed", srcType: "Person", dstType: "Order", reason: "other-space" },
    ]);
  });

  it("names a same-space relation that publishes no source-ordered orientation", async () => {
    const { opened } = await opening(
      corpus({
        types: ["Person"],
        relations: [["Person", "knows", "Person", ["dst"]]],
      }),
    );

    expect(opened.edges).toEqual([]);
    expect(opened.undrawn).toEqual([
      { edgeType: "knows", srcType: "Person", dstType: "Person", reason: "not-declared" },
    ]);
  });

  it("still answers when there is nothing to draw, out of an empty relation", async () => {
    const { asked, opened } = await opening(corpus({ types: ["Person"], relations: [] }));

    const links = await linksSql(opened, asked);
    expect(links).toContain("WHERE FALSE");
    expect(links).not.toContain("read_parquet([])");
  });
});
