import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Coordinator } from "@kanzo-tech/mosaic";
import { open } from "@fossil-lang/corpus";
import { openCorpus } from "./duck-source";

/**
 * What is left of this file, and it is one assertion — **say that first.**
 *
 * There were eleven here. Ten of them drove `duckBoundedSource`, the source over two ordinary
 * relations, and they were the only place any of this module's SQL was ever built: the crossfilter
 * predicate riding in the drawing query, two reads where there used to be three, both reads taking
 * the same sample, the link-length discard, the pin outside the filter, the metadata reads staying
 * out of the crossfilter, and the canvas' exemption from its own clause. That source is deleted —
 * `@kanzo-tech/graph` sends one source and it is the corpus' — and the tests went with it because a
 * test needs something to call.
 *
 * **The coverage is largely gone, and the part of that sentence that was wrong is now `corpus-
 * relations.test.ts`.** `openCorpus` takes a corpus fossil opened, which boots a wasm module before
 * it builds a single query, and this file read that as *unreachable from a test* — but the
 * manifests can be handed to fossil's `open` as bytes, and the wasm module ships inside
 * `@fossil-lang/corpus` and instantiates from bytes, which is how fossil's own suite boots it. So a
 * stub connector does reach `region`, `visibleCte` and `anchorCte`, over fossil's real addressing,
 * and the two defects that found is what that file is. What is still only held by the browser is
 * everything those queries *return*: `docs/showcases/workspace` draws the archive and
 * `docs/showcases/graph-bench` measures the generated corpora, and the figures on
 * `/docs/design/graph` were taken there.
 *
 * Two things still hold without a network, and they are why this file exists at all. Its **import
 * surface**: `fossil-import.test.ts` beside this one holds the names `duck-source.ts` takes off
 * `@fossil-lang/corpus` against the real package, because this suite loaded a module for months
 * whose imports did not resolve and said nothing. And **what the payload is read by**, below.
 *
 * ## The one rule that lost its witness, named rather than left dangling
 *
 * **The far end of an edge that leaves the window is drawn where the vertex is** — an anchor, past
 * `marks`, at its real coordinates, rather than a stub clipped to the border. This file used to
 * point at `graph-model.test.ts`, "draws the far end of an edge that leaves the window", as the
 * place that ran the rule in JavaScript over arrays. That test was `memorySource`'s and is deleted
 * too, so the pointer is now a lie and this paragraph is what replaces it.
 *
 * What verifies it today, exactly, and the answer is uncomfortable: **`tsc`, and the browser.**
 * `Slice.marks` being a required field is what makes an anchor expressible at all, and `resident.ts`
 * and `graph-model.ts` both read it — but the three assertions that an anchor gets no radius, no
 * colour and no residency were in the same deleted block, so **no test in this suite runs the anchor
 * rule any more.** What is left is the SQL in `anchorCte`, the 56.9%-of-lost-edges measurement on
 * `/docs/design/graph`, and the archive on screen. Stating that is the point of this paragraph: the
 * rule did not become better held by being pointed somewhere else.
 */

function harness() {
  const asked: string[] = [];
  const query = async (sql: string) => {
    asked.push(sql);
    if (sql.includes("parquet_metadata")) return [{ tile: 0, x0: 0, x1: 10, y0: 0, y1: 10 }];
    if (sql.startsWith("SELECT count(*) AS n FROM")) return [{ n: 3 }];
    return [];
  };
  const connector = { query: ({ sql }: { sql: string }) => query(sql) };
  const coordinator = new Coordinator(connector as never, {
    logger: null,
    consolidate: false,
    cache: false,
  });
  return { asked, coordinator, query };
}

/**
 * The payload is read by the names the corpus's addressing gives it — **and nothing on this side
 * fetches.**
 *
 * A host that signs opens the corpus under a namespace, `jobs/1`, and fossil lends every file to
 * the engine under `jobs/1/<path>`: those names are what DuckDB reads, and they are not URLs. This
 * side used to `HEAD` every address to decide whether to hold it as a buffer, which against a name
 * resolved to the page's own origin and 404'd — a request per file per window, spent to learn
 * nothing. The cache it fed is gone, and so is every request this module made on its own.
 *
 * **What this cannot prove:** that DuckDB reads those names. That is the engine's `lend`, and
 * `@kanzo-tech/mosaic`'s tests hold it.
 */
const WASM = readFileSync(
  resolve(process.cwd(), "node_modules/@fossil-lang/corpus/pkg/fossil_graph_wasm_bg.wasm"),
);

const MANIFESTS = {
  "graph.graph.yml": "name: graph\nprefix: ''\ncontainer: files\nvertices:\n- vertex/Person.vertex.yml\nedges: []\nversion: gar/v1\n",
  "vertex/Person.vertex.yml": [
    "type: Person",
    "vertex_count: 3",
    "chunk_size: 4096",
    "prefix: vertex/Person/",
    "projections:",
    "- path: ''",
    "  scale: 1",
    "  file_type: parquet",
    "  properties: []",
    "version: gar/v1",
    "",
  ].join("\n"),
};

describe("opening a corpus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the payload by the corpus's names, and never fetches", async () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    const { asked, coordinator, query } = harness();
    const corpus = await open("jobs/1", { query, manifestFiles: MANIFESTS, wasm: WASM });

    const { source, nodes } = await openCorpus({ corpus, engine: { coordinator } });
    await source.slice({
      limit: 100,
      minLinkPixels: 0,
      view: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
    } as never);

    expect(nodes).toBe('"jobs/1"."Person"');
    const slice = asked.find((sql) => sql.includes("FROM span"));
    expect(slice).toContain("'jobs/1/vertex/Person/chunk0.parquet'");
    expect(fetching).not.toHaveBeenCalled();
  });
});
