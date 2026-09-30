/**
 * Run a fossil program with fossil's own writer — `@fossil-lang/executor`, in Node — and write the
 * `fossil/1` corpus it produces to `dest`. The one writer there is: no CLI, no second implementation.
 *
 * The program is compiled under a placeholder `https://` origin rather than its `file://` path,
 * because a run in memory takes only locators the executor reads through a store, and it has no
 * store for `file://`. Every document and source the program names relative to itself lands under
 * that origin, and each is read from beside the program on disk (a document) or taken from
 * `sources` by the path the program wrote (a source).
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FossilExecutor, initFossilExecutor } from "@fossil-lang/executor";

const ORIGIN = "https://corpus.invalid/";

/**
 * @param {string} program   path to the `.fossil` file
 * @param {Record<string, Uint8Array>} sources   each source's bytes, by the path the program names it
 * @param {string} dest   the corpus directory; replaced whole
 * @returns {Promise<{ files: number, dropped: { table: string, dropped: number }[] }>}
 */
export async function writeCorpus(program, sources, dest) {
  await initFossilExecutor(
    readFileSync(fileURLToPath(import.meta.resolve("@fossil-lang/executor/pkg/fossil_df_wasm_bg.wasm"))),
  );
  const here = dirname(program);
  const relative = (locator) => {
    if (!locator.startsWith(ORIGIN)) throw new Error(`${program} names ${locator}, outside its own directory`);
    return locator.slice(ORIGIN.length);
  };

  const executor = new FossilExecutor(readFileSync(program, "utf8"), `${ORIGIN}${basename(program)}`);
  try {
    for (const { key, locator } of executor.missingDocuments()) {
      executor.registerDocument(key, readFileSync(join(here, relative(locator)), "utf8"));
    }
    const input = {};
    for (const { uri } of executor.sources()) {
      const bytes = sources[relative(uri)];
      if (!bytes) throw new Error(`${program} reads ${relative(uri)}, and no bytes were given for it`);
      input[uri] = bytes;
    }
    const { files, report } = await executor.runInMemory(input, "memory://corpus/");

    rmSync(dest, { force: true, recursive: true });
    // `fossil.json` last, as the writer orders it: a corpus without it is not one yet.
    const ordered = [...files.filter((f) => f.path !== "fossil.json"), ...files.filter((f) => f.path === "fossil.json")];
    for (const { path, bytes } of ordered) {
      mkdirSync(dirname(join(dest, path)), { recursive: true });
      writeFileSync(join(dest, path), bytes);
    }
    return { files: files.length, dropped: report.dropped };
  } finally {
    executor.free();
  }
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
