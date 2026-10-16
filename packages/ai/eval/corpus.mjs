/**
 * Write the evaluation set's corpora whole: for each graph of `@kanzo-tech/fixtures`
 * (`fixtures/graphs/<name>/`) the set asks, its `fetch.sh` (the data, pinned by digest, into `data/`),
 * then its `program.fossil` run by fossil's executor through the docs' one
 * writer (`docs/scripts/write-corpus.mjs`, as the workspace's archive is written) into
 * `docs/public/corpus/<name>/`, which the fixture page attaches by name. Both are gitignored: the data
 * is fetched and the corpus is compiler output. The tests' graphs are samples of the same programs'
 * data, checked in beside them; these are the whole datasets, which a model is measured on.
 *
 * Usage: `pnpm --filter @kanzo-tech/ai eval:corpus [name…]` — Nobel and SNB when none is named.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeCorpus } from "../../../docs/scripts/write-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPORA = resolve(HERE, "../../../fixtures/graphs");
const PUBLIC = resolve(HERE, "../../../docs/public/corpus");

/** Every file under `dir`, by its path from `root`. */
function files(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, root);
    return name.startsWith(".") ? [] : [[relative(root, path), new Uint8Array(readFileSync(path))]];
  });
}

const names = process.argv.slice(2);
for (const name of names.length ? names : ["nobel", "snb"]) {
  const dir = join(CORPORA, name);
  execFileSync("sh", [join(dir, "fetch.sh")], { stdio: "inherit" });
  const started = Date.now();
  const read = Object.fromEntries([["shapes.shex", new Uint8Array(readFileSync(join(dir, "shapes.shex")))], ...files(join(dir, "data"), dir)]);
  const dest = join(PUBLIC, name);
  const { files: written, dropped } = await writeCorpus(join(dir, "program.fossil"), read, dest);
  console.log(
    `  ${name}: ${written} files in ${((Date.now() - started) / 1000).toFixed(1)}s → ${dest}` +
      dropped.map((d) => ` (${d.table}: ${d.dropped} dropped)`).join(""),
  );
}
