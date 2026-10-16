/**
 * Write each fixture graph — `graphs/<name>/graph/`, checked in — from its checked-in sample, with
 * fossil's executor through the docs' one writer (`docs/scripts/write-corpus.mjs`), as the docs'
 * archive and the evaluation set's graphs are written. Offline: the sample stands where the program
 * reads `data/`. `pnpm --filter @kanzo-tech/fixtures write [name…]`; `check:generated` runs it and
 * fails on a difference, so a graph is never edited by hand and never stale against its program.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { writeCorpus } from "../docs/scripts/write-corpus.mjs";

const GRAPHS = join(dirname(fileURLToPath(import.meta.url)), "graphs");

/** Every file under `dir`, by its path from `dir`. */
function files(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, root) : [[relative(root, path), new Uint8Array(readFileSync(path))]];
  });
}

const names = process.argv.slice(2);
for (const name of names.length ? names : readdirSync(GRAPHS)) {
  const dir = join(GRAPHS, name);
  const read = Object.fromEntries([
    ["shapes.shex", new Uint8Array(readFileSync(join(dir, "shapes.shex")))],
    ...files(join(dir, "sample")).map(([path, bytes]) => [`data/${path}`, bytes]),
  ]);
  const { files: written, dropped } = await writeCorpus(join(dir, "program.fossil"), read, join(dir, "graph"));
  // A row dropped is a reference that is null — the United Nations was born nowhere — never one the
  // sample cut: `sample.mjs` keeps every row a kept row names.
  console.log(`  ${name}: ${written} files` + dropped.filter((d) => d.dropped).map((d) => ` (${d.table}: ${d.dropped} dropped)`).join(""));
}
