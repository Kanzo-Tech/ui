"use client";

import { engine, type Engine } from "@kanzo-tech/mosaic";
import { useEffect, useState } from "react";
import { attachWritten } from "@/lib/attach-graph";

export { ARCHIVE_KINDS } from "@/example/archive";

/**
 * The archive the workspace showcase draws, as a GraphAr graph — written by fossil's executor through
 * `showcases/workspace/corpus/build-corpus.mjs`. Prefixed, because a path handed to DuckDB is not.
 */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

/** The catalog the archive is attached under: its tables are `"archive"."Node"`, `"archive".graphar_vertex_types`, … */
export const FROM = "archive";

let attaching: Promise<Engine> | null = null;

/** A failure `onFailure` handed over, as a sentence: a host keys on its `code` before falling back to this. */
export const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The archive attached to the page's one engine, as `GraphRoot`'s `from` and `engine` — both `null`
 * until it is, and on the server. One attach for the page: every preview reads the same catalog
 * through the same engine. A failed attach goes to `onFailure`, beside the root's own failures.
 */
export function useArchive(onFailure: (error: unknown) => void): { from: string | null; engine: Engine | null } {
  const [attached, setAttached] = useState<Engine | null>(null);
  useEffect(() => {
    if (!attaching) {
      const started = engine().then(async (e) => {
        // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem.
        await attachWritten(e, FROM, `${window.location.origin}${ARCHIVE}`);
        return e;
      });
      attaching = started;
      // A failed attach is forgotten, so the next preview tries again instead of inheriting it.
      started.catch(() => {
        if (attaching === started) attaching = null;
      });
    }
    let live = true;
    attaching.then(
      (e) => live && setAttached(e),
      (error) => live && onFailure(error),
    );
    return () => {
      live = false;
    };
  }, [onFailure]);
  return { from: attached ? FROM : null, engine: attached };
}
