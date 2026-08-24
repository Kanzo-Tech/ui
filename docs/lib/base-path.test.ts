import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * No site path is written as a bare string where `basePath` would never reach it.
 *
 * The published documentation lives at `kanzo-tech.github.io/ui`, so every URL the app emits needs
 * that prefix. Next adds it to the ones it owns — `Link`, `next/image`, `_next/*` — and to nothing
 * else. **A string is just a string**, and the failure is silent in a way that survives every check
 * in this repository: the build passes, the page renders, and the thing at the end of the URL is a
 * 404 nobody sees. It bit three times in one afternoon before this file existed:
 *
 * · `showcases/workspace/graph-state.tsx` held `"/corpus/archive"` — the graph canvas stayed empty.
 * · `components/preview-iframe.tsx` held `"/view/showcases/<name>"` — EVERY showcase embed on the
 *   site pointed at the organisation's root instead, so every one of them was a 404 in a box.
 * · three image-cropper examples and one showcase held `"/example/<file>.svg"` — a broken image and
 *   an extractor with nothing to read.
 *
 * The fix in all four is the same and is what this guard requires: go through
 * `example/assets.ts`'s `asset()`, or read `NEXT_PUBLIC_BASE_PATH` — the one variable
 * `next.config.ts` sets, empty everywhere but the export.
 *
 * ## What this guard cannot prove
 *
 * - **It does not read `href`.** `Link href="/docs"` is correct and common — Next prefixes it — and
 *   `<a href="/docs">` is a defect, and the two are indistinguishable without resolving what the
 *   component is. `BreadcrumbLink` is `ark.a` and was exactly that defect in
 *   `showcases/graph-bench/default.tsx`; it is fixed, and nothing here would have caught it. If
 *   this rule is ever worth extending, that is the direction and it needs a real parse.
 * - **Only literals.** A path assembled at runtime, or read from a data file, is invisible.
 * - **It cannot tell you the prefix is RIGHT**, only that the value is not a bare literal. A call
 *   to `asset()` with a filename that does not exist passes here.
 * - **It reads `docs/` only.** The library packages emit no site URLs; if one ever does, this scan
 *   will not be looking at it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, "..");

/** The directories that produce markup or fetches. `content/` is prose and `public/` is assets. */
const SCANNED = ["app", "components", "examples", "lib", "showcases"];

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "out") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
    }
  };
  for (const dir of SCANNED) walk(join(DOCS, dir));
  return out.sort();
}

/**
 * The two positions Next is guaranteed never to rewrite: an element's `src`, and what `fetch` is
 * handed. Both matched against a literal opening with `/` — a relative path is somebody's own
 * business and an absolute URL has a host.
 */
const OFFENDERS: readonly { what: string; pattern: RegExp }[] = [
  { what: "src", pattern: /\bsrc\s*=\s*(?:"\/(?!\/)|\{\s*"\/(?!\/)|\{\s*`\/(?!\/))/g },
  { what: "fetch", pattern: /\bfetch\s*\(\s*(?:"\/(?!\/)|`\/(?!\/))/g },
  { what: "src: in an object", pattern: /\bsrc\s*:\s*(?:"\/(?!\/)|`\/(?!\/))/g },
];

describe("a site path never reaches the browser without its basePath", () => {
  it("has no bare absolute path in a `src` or a `fetch`", () => {
    const found: string[] = [];
    for (const file of sources()) {
      const text = readFileSync(file, "utf8");
      for (const { what, pattern } of OFFENDERS) {
        for (const match of text.matchAll(pattern)) {
          const line = text.slice(0, match.index).split("\n").length;
          found.push(`${relative(DOCS, file)}:${line} — bare absolute path in ${what}`);
        }
      }
    }

    expect(
      found,
      "use `asset()` from example/assets.ts, or prefix with NEXT_PUBLIC_BASE_PATH — a bare /path is a 404 on the published site and renders fine everywhere else",
    ).toEqual([]);
  });

  it("is looking at the corpus it claims to", () => {
    // The assertion above is an assertion of absence, so an empty scan passes it silently. These
    // are floors under today's tree, not pins.
    const files = sources();
    expect(files.length).toBeGreaterThan(200);
    for (const dir of SCANNED) {
      expect(
        files.some((f) => relative(DOCS, f).startsWith(`${dir}/`)),
        `${dir}/ contributed no files — the walk is broken, not the tree`,
      ).toBe(true);
    }
  });
});
