/**
 * Compile the workspace's archive into a corpus with fossil's writer, `@fossil-lang/executor`.
 *
 * The showcase used to do this in the tab: build the graph, serialise two CSVs, register them in
 * DuckDB's virtual filesystem, query them as relations. That worked and it taught the wrong thing —
 * `@kanzo-tech/graph` ships one source and it reads a corpus, so a showcase that hands it relations
 * was demonstrating a path no product takes.
 *
 * Usage:  node --import ./register.mjs build-corpus.mjs   (or `pnpm --filter @kanzo-tech/docs corpus`)
 * Output: docs/public/corpus/archive/ — gitignored, and built by `build:static` before the export.
 *
 * **The two CSVs are not `graph-data.ts`'s.** `nodesCsv` there writes `x` and `y`, which the layout
 * pass owns, and `edgesCsv` writes a bare pair, which the union of the two mappings rejects. The
 * shapes fossil wants are close enough to look identical and different enough to fail, so they are
 * written here rather than imported and trimmed.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { csv, writeCorpus } from "../../../scripts/write-corpus.mjs";
import { buildArchiveGraph } from "../graph-data.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(HERE, "../../../public/corpus/archive");

/** Every property the shape declares, in one place, so the two projections cannot drift apart. */
const PROPS = ["label", "kind", "hall", "region", "signed", "degree", "reports", "closed", "tags"];

const graph = buildArchiveGraph();
const by = new Map(graph.nodes.map((n) => [n.id, n]));
const header = ["id", ...PROPS].join(",");
const row = (n) => [n.id, ...PROPS.map((p) => n[p])].join(",");

const started = Date.now();
const { dropped } = await writeCorpus(
  join(HERE, "archive.fossil"),
  {
    "archive.shex": readFileSync(join(HERE, "archive.shex")),
    "nodes.csv": csv(header, (line) => graph.nodes.forEach((n) => line(row(n)))),
    // The source's properties repeated on every edge, which is the price of the UNION rather than
    // redundancy for its own sake — see the note in `archive.fossil`.
    "edges.csv": csv(`${header},target`, (line) => {
      for (const e of graph.edges) {
        const n = by.get(e.source);
        if (n) line(`${row(n)},${e.target}`);
      }
    }),
  },
  DEST,
);
console.log(
  `  archive: ${graph.nodes.length} vertices, ${graph.edges.length} edges in ${((Date.now() - started) / 1000).toFixed(1)}s → ${DEST}` +
    dropped.map((d) => ` (${d.table}: ${d.dropped} dropped)`).join(""),
);
