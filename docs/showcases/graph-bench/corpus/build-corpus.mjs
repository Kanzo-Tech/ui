/**
 * Build the benchmark's corpora once, with fossil, so the browser never generates one.
 *
 * The page used to build its own graph on every size change: 454 ms of generation at 200,000 nodes
 * and 751 ms of upload for 1.4M links, both synchronous on the main thread, which is why a million
 * froze the tab for six seconds. It also meant the benchmark spent most of its columns measuring
 * the fixture — `Ingest` was already labelled as "the fixture's cost and not the product's".
 *
 * A corpus is a compiler's output: write once with the real writer, read many with the real reader.
 * **`@fossil-lang/executor` is the writer, and the only one.** It runs `bench.fossil` in Node and
 * writes `fossil/1` — one Parquet per vertex type and per relation, `fossil.json` last. It carries
 * the graph and no picture: where a point goes is the viewer's layout, on the GPU.
 *
 * Usage:  node build-corpus.mjs [--sizes 2000,10000]
 * Output: docs/public/bench/<size>/  — gitignored; tens of megabytes at the top sizes.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { csv, writeCorpus } from "../../../scripts/write-corpus.mjs";
import { hyperbolic } from "../generate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../../public/bench");

/**
 * The sizes worth having on disk.
 *
 * A million is in the list precisely because it is the one the browser could not build.
 */
const DEFAULT_SIZES = [2_000, 10_000, 50_000, 200_000, 1_000_000];

/** The generator's own square. Only `community` and the links leave this file, so any positive number would do. */
const EXTENT = 4096;

/**
 * A node list and an edge list — the second denormalised onto the first, both written in chunks.
 *
 * The node list exists because only a subject map mints a vertex: an edge list alone loses every
 * node that is never a source, which at 2,000 was a third of them. The edge list repeats the
 * source's `community` because fossil unions the two mappings before deduping, so both must project
 * the same columns. Dedup is by subject IRI, so a node named once per edge still becomes one vertex.
 *
 * The first draft built each file with `rows.join("\n")` and it is the **builder** that broke first
 * at five million, not the reader: thirty-five million edge rows is around 700 MB of text and V8
 * caps a single string near 512 MB, so `join` threw before fossil was even invoked. Worth recording
 * because it is the opposite of the failure this benchmark was looking for — the corpus is a
 * compiler output precisely so the expensive part happens once, offline, and the part that broke
 * was the offline one.
 */
async function build(size) {
  const data = hyperbolic({ pointCount: size, spaceSize: EXTENT });
  const dest = join(PUBLIC, String(size));
  const started = Date.now();
  await writeCorpus(
    join(HERE, "bench.fossil"),
    {
      "nodes.csv": csv("id,community", (line) => {
        for (let n = 0; n < size; n += 1) line(`${n},${data.community[n]}`);
      }),
      "edges.csv": csv("id,community,target", (line) => {
        for (let e = 0; e < data.links.length; e += 2) {
          const source = data.links[e];
          line(`${source},${data.community[source]},${data.links[e + 1]}`);
        }
      }),
    },
    dest,
  );
  console.log(`  ${size}: written in ${((Date.now() - started) / 1000).toFixed(1)}s → ${dest}`);
}

const args = process.argv.slice(2);
const at = args.indexOf("--sizes");
const sizes = (at >= 0 ? args[at + 1] : undefined)?.split(",").map(Number) ?? DEFAULT_SIZES;

console.log(`building ${sizes.length} corpora with @fossil-lang/executor`);
for (const size of sizes) await build(size);
console.log("done — these are gitignored; re-run this script to rebuild them");
