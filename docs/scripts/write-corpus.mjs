/**
 * Run a fossil program with fossil's own writer — `@fossil-lang/executor`, in Node — and write the
 * `fossil/1` corpus it produces to `dest`. The one writer there is: no CLI, no second implementation.
 *
 * The program runs in memory under a placeholder `https://` origin rather than its `file://` path:
 * a run over `files` reads every document and source from them by the location fossil resolves it
 * to, so each file the program names beside itself is handed over under that origin.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { initFossilExecutor, run } from "@fossil-lang/executor";

const ORIGIN = "https://corpus.invalid/";

/**
 * @param {string} program   path to the `.fossil` file
 * @param {Record<string, Uint8Array>} files   every document and source it reads, by the path the program names it
 * @param {string} dest   the corpus directory; replaced whole
 * @returns {Promise<{ files: number, dropped: { table: string, dropped: number }[] }>}
 */
export async function writeCorpus(program, files, dest) {
  // Node's `fetch` rejects `file://`, so the module's bytes are handed over first.
  await initFossilExecutor(
    readFileSync(fileURLToPath(import.meta.resolve("@fossil-lang/executor/pkg/fossil_df_wasm_bg.wasm"))),
  );
  const { files: corpus, report } = await run(readFileSync(program, "utf8"), {
    files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [`${ORIGIN}${path}`, bytes])),
    path: `${ORIGIN}${basename(program)}`,
  });

  rmSync(dest, { force: true, recursive: true });
  // `fossil.json` last, as the writer orders it: a corpus without it is not one yet.
  const ordered = [...corpus.filter((f) => f.path !== "fossil.json"), ...corpus.filter((f) => f.path === "fossil.json")];
  for (const { path, bytes } of ordered) {
    mkdirSync(dirname(join(dest, path)), { recursive: true });
    writeFileSync(join(dest, path), bytes);
  }
  return { files: corpus.length, dropped: report.dropped };
}

/** A CSV as bytes, built in chunks, so a file past V8's string limit never becomes one string. */
export function csv(header, rows) {
  const chunks = [];
  let buffer = `${header}\n`;
  rows((line) => {
    buffer += `${line}\n`;
    if (buffer.length > 8_000_000) {
      chunks.push(Buffer.from(buffer));
      buffer = "";
    }
  });
  chunks.push(Buffer.from(buffer));
  return new Uint8Array(Buffer.concat(chunks));
}
