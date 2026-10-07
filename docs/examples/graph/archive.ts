"use client";

import { engine, type Coordinator } from "@kanzo-tech/ui/analytics";
import { useEffect, useState } from "react";
import { attach } from "@fossil-lang/corpus";

export { ARCHIVE_KINDS } from "@/example/archive";

/**
 * The archive the workspace showcase draws, as `fossil/1` — written by fossil's executor through
 * `showcases/workspace/corpus/build-corpus.mjs`. Prefixed, because a path handed to DuckDB is not.
 */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

/** The catalog the archive is attached under: its tables are `"archive"."Node"`, `"archive".fossil_tables`, … */
export const FROM = "archive";

let attaching: Promise<Coordinator> | null = null;

/** A failure `onFailure` handed over, as a sentence: a host keys on its `code` before falling back to this. */
export const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The archive attached to the page's one engine, as `GraphRoot`'s `from` and `coordinator` — both
 * `null` until it is, and on the server. One attach for the page: every preview reads the same catalog
 * through the same coordinator. A failed attach goes to `onFailure`, beside the root's own failures.
 */
export function useArchive(onFailure: (error: unknown) => void): { from: string | null; coordinator: Coordinator | null } {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  useEffect(() => {
    if (!attaching) {
      const started = engine().then(async (e) => {
        // Origin-qualified: DuckDB-WASM resolves a root-relative path in its own filesystem.
        await attach(FROM, { engine: e, url: `${window.location.origin}${ARCHIVE}` });
        return e.coordinator;
      });
      attaching = started;
      // A failed attach is forgotten, so the next preview tries again instead of inheriting it.
      started.catch(() => {
        if (attaching === started) attaching = null;
      });
    }
    let live = true;
    attaching.then(
      (attached) => live && setCoordinator(attached),
      (error) => live && onFailure(error),
    );
    return () => {
      live = false;
    };
  }, [onFailure]);
  return { from: coordinator ? FROM : null, coordinator };
}
