import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as fossil from "@fossil-lang/corpus";

/**
 * Every name `duck-source.ts` takes off `@fossil-lang/corpus`, checked against the real package.
 *
 * **This exists because ninety-seven tests passed against an import that did not resolve.** The
 * door was collapsed on the other side — `resolveCorpus` and `openCorpus` folded into one `open`
 * whose depth is decided by which capability the caller lends — and this package went on importing
 * `resolveCorpus` for as long as nobody ran a docs build. Nothing here went red, and the reason is
 * two mechanisms that both had to be understood before a guard could be written:
 *
 * - **The library build cannot see it.** `vite.config.ts` externalises `/^@fossil-lang\//`, which
 *   is right — a renderer that inlined the corpus reader would ship a second copy of a WASM module
 *   the host loads once — and the price is that Rollup never resolves a single name through it.
 * - **The test run could see it and does not look.** vite-node rewrites a static import into a
 *   namespace lookup, so a name that is not there arrives as `undefined` instead of the link error
 *   Node would raise. Measured: renaming this file's import to a name the package has never had
 *   left all ninety-seven passing.
 *
 * So the only thing that failed was `pnpm --filter @kanzo-tech/docs build`, minutes into a webpack
 * compile, in another workspace. That is a long way from the file that is wrong.
 *
 * **The list is read out of the source, never restated here.** A guard that spelled the four names
 * again would be a fifth place they are written down, and the first to go stale — it would still
 * pass while `duck-source.ts` imported something else entirely. What this asserts is the relation
 * *what that file asks for is what this package has*, which is the only form of it that cannot
 * drift.
 *
 * **What it cannot check is the type import**, and that is not a gap this side can close:
 * `OpenOptions` is erased before anything runs, so `tsc` is the only thing that ever sees it —
 * `pnpm typecheck` is the guard for that half, against the `.d.ts` the linked package emits.
 *
 * Read from `process.cwd()` and not from `import.meta.url`, which is how every guard in
 * `@kanzo-tech/ui` finds its own directory: this suite runs under jsdom, where `import.meta.url` is
 * an `http:` URL and `fileURLToPath` refuses it. Vitest's cwd is the package root.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "src/duck-source.ts"), "utf8");

/** The value import, with any `as` alias stripped — the alias is ours, the name is theirs. */
function imported(): string[] {
  const block = /^import \{([\s\S]*?)\} from "@fossil-lang\/corpus";$/m.exec(SOURCE);
  if (!block) throw new Error("duck-source.ts has no value import from @fossil-lang/corpus");
  return (block[1] as string)
    .split(",")
    .map((entry) => entry.trim().split(/\s+as\s+/)[0]?.trim() ?? "")
    .filter((name) => name.length > 0);
}

describe("what duck-source.ts takes off fossil's door", () => {
  /**
   * The regex above is the part that can fail silently — a reformatted import block that no longer
   * matches would make every assertion below vacuous. An empty list is that failure, so it is the
   * first thing asserted rather than the thing nobody checks.
   */
  it("reads a non-empty list of names out of the source", () => {
    expect(imported().length).toBeGreaterThan(0);
  });

  it("finds every one of them on the package", () => {
    const missing = imported().filter((name) => !(name in fossil));
    expect(missing).toEqual([]);
  });

  /**
   * One name pinned, because `open` is the whole shape of the collapse: the depth of the answer
   * follows the capability the caller lends, so there is exactly one callable here and it is this.
   * A package that exported it as anything but a function would satisfy the test above.
   */
  it("answers with a callable door", () => {
    expect(typeof fossil.open).toBe("function");
  });
});
