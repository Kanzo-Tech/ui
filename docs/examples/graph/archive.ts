"use client";

import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { engine, type Engine } from "@kanzo-tech/mosaic/engine";
import { useEffect, useState } from "react";
import { attachWritten } from "@/lib/attach-graph";

export { ARCHIVE_KINDS } from "@/example/archive";

/**
 * The archive the workspace showcase draws, as a GraphAr graph — written by fossil's executor through
 * `showcases/workspace/corpus/build-corpus.mjs`. Prefixed, because a path handed to DuckDB is not.
 */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

/** The catalog the archive is attached under. */
const CATALOG = "archive";

/** What a page holds once the archive is attached: the engine, and the graph on it. */
interface Attached {
  readonly engine: Engine;
  readonly graph: Graph;
}

let attaching: Promise<Attached> | null = null;

/** A failure `onFailure` handed over, as a sentence: a host keys on its `code` before falling back to this. */
export const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The archive attached to the page's one engine, as `GraphRoot`'s `graph` and `engine` — both `null`
 * until it is, and on the server. One attach for the page: every preview reads the same graph
 * through the same engine. A failed attach goes to `onFailure`, beside the root's own failures.
 */
export function useArchive(onFailure: (error: unknown) => void): { graph: Graph | null; engine: Engine | null } {
  const [attached, setAttached] = useState<Attached | null>(null);
  useEffect(() => {
    if (!attaching) {
      const started = engine().then(async (e) => {
        // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem.
        const graph = await attachWritten(e, CATALOG, `${window.location.origin}${ARCHIVE}`);
        return { engine: e, graph };
      });
      attaching = started;
      // A failed attach is forgotten, so the next preview tries again instead of inheriting it.
      started.catch(() => {
        if (attaching === started) attaching = null;
      });
    }
    let live = true;
    attaching.then(
      (a) => live && setAttached(a),
      (error) => live && onFailure(error),
    );
    return () => {
      live = false;
    };
  }, [onFailure]);
  return { graph: attached?.graph ?? null, engine: attached?.engine ?? null };
}
