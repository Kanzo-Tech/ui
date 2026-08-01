/**
 * Build the benchmark's corpora once, with fossil, so the browser never generates one.
 *
 * The page used to build its own graph on every size change: 454 ms of generation at 200,000 nodes
 * and 751 ms of upload for 1.4M links, both synchronous on the main thread, which is why a million
 * froze the tab for six seconds. It also meant the benchmark spent most of its columns measuring
 * the fixture — `Ingest` was already labelled as "the fixture's cost and not the product's".
 *
 * A corpus is a compiler's output. ADR-0001 rests on that premise and this is it applied to the
 * benchmark itself: write once with the real writer, read many with the real reader.
 *
 * **`fossil run` is the writer, and the only one.** It emits the GraphAr tree and then runs the W3
 * layout pass — weakly-connected components for `cluster_id`, phyllotaxis placement for `x`/`y`,
 * and a rewrite of each vertex Parquet in Morton order. That ordering is the point: a bbox query
 * against it prunes whole row groups on their statistics, which is the larger-than-RAM half
 * ADR-0001 records as unmeasured. Computing Morton here instead would be a second implementation of
 * something fossil owns, and two writers is how they come to disagree.
 *
 * Usage:  node build-corpus.mjs [--sizes 2000,10000] [--fossil <path>]
 * Output: docs/public/bench/<size>/  — gitignored; tens of megabytes at the top sizes.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hyperbolic } from "../generate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/bench");

/**
 * The sizes worth having on disk.
 *
 * A million is in the list precisely because it is the one the browser could not build. Reading it
 * back should cost what two thousand costs — the working set is the window, not the corpus — and if
 * it does not, that is the finding.
 */
const DEFAULT_SIZES = [2_000, 10_000, 50_000, 200_000, 1_000_000];

/** cosmos.gl's simulation box, so the written coordinates are already the camera's space. */
const SPACE = 4096;

function csvFor(size) {
  const data = hyperbolic({ pointCount: size, spaceSize: SPACE });
  const nodes = ["id,community"];
  for (let i = 0; i < data.pointCount; i++) nodes.push(`${i},${data.community[i]}`);

  const edges = ["source,target"];
  for (let e = 0; e < data.links.length; e += 2) {
    edges.push(`${data.links[e]},${data.links[e + 1]}`);
  }
  return { edges: edges.join("\n"), nodes: nodes.join("\n") };
}

function build(size, fossil) {
  const dest = join(PUBLIC, String(size));
  rmSync(dest, { force: true, recursive: true });
  mkdirSync(dest, { recursive: true });

  const { edges, nodes } = csvFor(size);
  // Beside the mapping, because `io.csv` resolves relative to the program's own directory.
  writeFileSync(join(HERE, "nodes.csv"), nodes);
  writeFileSync(join(HERE, "edges.csv"), edges);

  const started = Date.now();
  execFileSync(fossil, ["run", join(HERE, "bench.fossil"), "--dest", `file://${dest}`], {
    stdio: "inherit",
  });
  console.log(`  ${size}: written in ${((Date.now() - started) / 1000).toFixed(1)}s → ${dest}`);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const sizes = flag("sizes")?.split(",").map(Number) ?? DEFAULT_SIZES;
/**
 * The writer, named rather than guessed.
 *
 * An earlier draft resolved a relative path to the sibling fossil checkout and miscounted the
 * levels — and would have broken anyway the moment anyone's layout differed. `fossil` on `PATH` is
 * the normal case; `--fossil <path>` or `FOSSIL_BIN` covers a local `cargo build` without pinning
 * this script to one machine's directory tree.
 */
const fossil = flag("fossil") ?? process.env.FOSSIL_BIN ?? "fossil";

console.log(`building ${sizes.length} corpora with ${fossil}`);
for (const size of sizes) build(size, fossil);
console.log("done — these are gitignored; re-run this script to rebuild them");
