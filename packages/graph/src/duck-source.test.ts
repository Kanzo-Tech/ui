import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Coordinator } from "@kanzo-tech/mosaic";
import { openCorpus } from "./duck-source";

/**
 * What is left of this file, and it is one assertion — **say that first.**
 *
 * There were eleven here. Ten of them drove `duckBoundedSource`, the source over two ordinary
 * relations, and they were the only place any of this module's SQL was ever built: the crossfilter
 * predicate riding in the drawing query, two reads where there used to be three, both reads taking
 * the same sample, the link-length discard, the pin outside the filter, the metadata reads staying
 * out of the crossfilter, and the canvas' exemption from its own clause. That source is deleted —
 * `@kanzo-tech/graph` sends one source and it is the corpus' — and the tests went with it because a
 * test needs something to call.
 *
 * **The coverage is largely gone, and the part of that sentence that was wrong is now `corpus-
 * relations.test.ts`.** `openCorpus` fetches manifests over HTTP and boots a wasm module before it
 * builds a single query, and this file read that as *unreachable from a test* — but the manifests
 * are read through `readText`, which is a parameter, and the wasm module ships inside
 * `@fossil-lang/corpus` and instantiates from bytes, which is how fossil's own suite boots it. So a
 * stub connector does reach `region`, `visibleCte` and `anchorCte`, over fossil's real addressing,
 * and the two defects that found is what that file is. What is still only held by the browser is
 * everything those queries *return*: `docs/showcases/workspace` draws the archive and
 * `docs/showcases/graph-bench` measures the generated corpora, and the figures on
 * `/docs/design/graph` were taken there.
 *
 * Two things still hold without a network, and they are why this file exists at all. Its **import
 * surface**: `fossil-import.test.ts` beside this one holds the names `duck-source.ts` takes off
 * `@fossil-lang/corpus` against the real package, because this suite loaded a module for months
 * whose imports did not resolve and said nothing. And **which reader reads the manifests**, below —
 * the one thing that happens before a byte of payload is wanted, which is what makes it reachable
 * from here.
 *
 * ## The one rule that lost its witness, named rather than left dangling
 *
 * **The far end of an edge that leaves the window is drawn where the vertex is** — an anchor, past
 * `marks`, at its real coordinates, rather than a stub clipped to the border. This file used to
 * point at `graph-model.test.ts`, "draws the far end of an edge that leaves the window", as the
 * place that ran the rule in JavaScript over arrays. That test was `memorySource`'s and is deleted
 * too, so the pointer is now a lie and this paragraph is what replaces it.
 *
 * What verifies it today, exactly, and the answer is uncomfortable: **`tsc`, and the browser.**
 * `Slice.marks` being a required field is what makes an anchor expressible at all, and `resident.ts`
 * and `graph-model.ts` both read it — but the three assertions that an anchor gets no radius, no
 * colour and no residency were in the same deleted block, so **no test in this suite runs the anchor
 * rule any more.** What is left is the SQL in `anchorCte`, the 56.9%-of-lost-edges measurement on
 * `/docs/design/graph`, and the archive on screen. Stating that is the point of this paragraph: the
 * rule did not become better held by being pointed somewhere else.
 */

function harness() {
  const asked: string[] = [];
  const connector = {
    query: ({ sql }: { sql: string }) => {
      asked.push(sql);
      // One row, in the shape both reads answer in: `column`/`fillColumn` fall back to iterating
      // plain objects when there is no Arrow child, which is what makes a stub possible at all.
      return Promise.resolve([
        {
          local: 0,
          id: 3,
          x: 1,
          y: 2,
          category: 0,
          matched: 41,
          mark: 1,
          src: 0,
          dst: 0,
          weight: 1,
        },
      ]);
    },
  };
  const coordinator = new Coordinator(connector as never, {
    logger: null,
    consolidate: false,
    cache: false,
  });
  return { asked, coordinator };
}

/**
 * Which reader reads the manifests — the one question about `openCorpus` a stub can answer.
 *
 * `fetch` is right for a corpus served off an origin the page can already read, and wrong for a host
 * whose blobs sit behind a signature: the URL fossil composes is correct and unreadable, and nothing
 * else on the options carries a credential. The alternative such a host reaches for is composing the
 * addresses itself, which is the convention-copying the door exists to end — so the reader is lent
 * instead, and fossil signs nothing it does not already address.
 *
 * **What this cannot prove:** that anything after the index reads. The index below names no type,
 * so the call stops there. What is asserted is the part that happens first and is the whole of the
 * pass-through: *who* was asked, and *for what*. The module is booted from the bytes the package
 * ships, because fossil awaits its boot before the first read and jsdom's `fetch` cannot load it —
 * which is also what `wasm` on the options is for.
 */
const WASM = readFileSync(
  resolve(process.cwd(), "node_modules/@fossil-lang/corpus/pkg/fossil_graph_wasm_bg.wasm"),
);

describe("opening a corpus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the host's reader for the manifest, and never fetches", async () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    const reading = vi.fn(async () => "vertices: []\nedges: []\n");
    const { coordinator } = harness();

    await openCorpus({
      coordinator,
      dest: "https://signed.example/corpus/archive",
      readText: reading,
      wasm: WASM,
    }).catch(() => undefined);

    // The index, at the address fossil composed — this side names no file and joins no path.
    expect(reading.mock.calls).toEqual([["https://signed.example/corpus/archive/graph.graph.yml"]]);
    expect(fetching).not.toHaveBeenCalled();
  });
});
