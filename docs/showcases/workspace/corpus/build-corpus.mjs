/**
 * Compile the workspace's archive into a corpus, once, with the real writer.
 *
 * The showcase used to do this in the tab: build the graph, serialise two CSVs, register them in
 * DuckDB's virtual filesystem, query them as relations. That worked and it taught the wrong thing —
 * `@kanzo-tech/graph` ships one source and it reads a corpus, so a showcase that hands it relations
 * was demonstrating a path no product takes.
 *
 * Usage:  node build-corpus.mjs [--fossil <path>]
 * Output: docs/public/corpus/archive/ — gitignored, a couple of megabytes.
 *
 * **The two CSVs are not `graph-data.ts`'s.** `nodesCsv` there writes `x` and `y`, which the layout
 * pass owns, and `edgesCsv` writes a bare pair, which the union of the two mappings rejects. The
 * shapes fossil wants are close enough to look identical and different enough to fail, so they are
 * written here rather than imported and trimmed.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildArchiveGraph } from "../graph-data.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(HERE, "../../../public/corpus/archive");

/** Every property the shape declares, in one place, so the two projections cannot drift apart. */
const PROPS = ["label", "kind", "hall", "region", "signed", "degree", "reports", "closed", "tags"];

function csvs() {
  const graph = buildArchiveGraph();
  const by = new Map(graph.nodes.map((n) => [n.id, n]));

  const header = ["id", ...PROPS];
  const row = (n) => [n.id, ...PROPS.map((p) => n[p])].join(",");

  writeFileSync(
    join(HERE, "nodes.csv"),
    [header.join(","), ...graph.nodes.map(row)].join("\n"),
  );

  // The source's properties repeated on every edge, which is the price of the UNION rather than
  // redundancy for its own sake — see the note in `archive.fossil`.
  writeFileSync(
    join(HERE, "edges.csv"),
    [
      [...header, "target"].join(","),
      ...graph.edges
        .map((e) => {
          const n = by.get(e.source);
          return n ? `${row(n)},${e.target}` : null;
        })
        .filter(Boolean),
    ].join("\n"),
  );

  return graph;
}

const args = process.argv.slice(2);
const at = args.indexOf("--fossil");
const fossil = (at >= 0 ? args[at + 1] : undefined) ?? process.env.FOSSIL_BIN ?? "fossil";

const graph = csvs();
rmSync(DEST, { force: true, recursive: true });
mkdirSync(DEST, { recursive: true });

const started = Date.now();
// `io.csv` resolves against the process's working directory rather than the program's, so run from
// beside the mapping and its bare filenames mean what they read as. `--dest` stays absolute.
execFileSync(fossil, ["run", join(HERE, "archive.fossil"), "--dest", `file://${DEST}`], {
  cwd: HERE,
  stdio: "inherit",
});
console.log(
  `  archive: ${graph.nodes.length} vertices, ${graph.edges.length} edges in ${(
    (Date.now() - started) / 1000
  ).toFixed(1)}s → ${DEST}`,
);
