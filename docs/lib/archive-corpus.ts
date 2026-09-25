"use client";

import { useEffect, useState } from "react";
import { openCorpus, type OpenedCorpus } from "@kanzo-tech/graph/duckdb";
import { engine } from "@kanzo-tech/ui/analytics";

/**
 * The Guild's archive, opened once for the whole graph page.
 *
 * **It is here rather than in an example for the reason a fixture used to be**: four previews on
 * `/docs/graph` draw the same graph, and the point of three of them is that they are the fourth
 * wearing different chrome — which only holds if the bytes are literally the same. What changed is
 * what "the same bytes" costs. The fixture was `sightings-graph.ts`, a force layout run in the tab
 * and handed to `memorySource` as three typed arrays; that source is deleted, so a graph on this
 * page is a corpus `fossil` compiled, read through DuckDB.
 *
 * **And sharing is no longer only tidiness — it is one DuckDB.** The database is `engine()`'s, the
 * page's one; what is memoised here is the opening, so four previews open the archive once.
 *
 * The corpus is gitignored and built by `showcases/workspace/corpus/build-corpus.mjs`. A checkout
 * that has not built it gets `unopened` below — the reader's own error, naming the URL — rather than
 * a spinner that never resolves.
 */

/**
 * Where the compiled archive is served from.
 *
 * **Prefixed, because this is the one asset URL Next does not fix for us.** `Link` and `next/image`
 * rewrite themselves under `basePath`; a string handed to DuckDB is just a string, so under a
 * project page at `/ui` a bare `/corpus/…` is a 404 with no error anywhere. `NEXT_PUBLIC_BASE_PATH`
 * is the same variable `next.config.ts` reads, so the two cannot disagree.
 */
export const ARCHIVE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/archive`;

let opening: Promise<OpenedCorpus> | null = null;

/**
 * The opened archive — source for a canvas, and the relations registered under their own names.
 *
 * Origin-qualified: DuckDB-WASM resolves a root-relative path against its own virtual filesystem
 * rather than against the page's origin, and finds nothing there.
 */
export function archive(): Promise<OpenedCorpus> {
  opening ??= engine().then(({ coordinator }) =>
    openCorpus({ coordinator, dest: `${window.location.origin}${ARCHIVE}` }),
  );
  return opening;
}

/** The opened corpus as React state, or the reason it could not be opened. */
export function useArchive(): { opened: OpenedCorpus | null; unopened: string | null } {
  const [opened, setOpened] = useState<OpenedCorpus | null>(null);
  const [unopened, setUnopened] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    archive().then(
      (corpus) => {
        if (live) setOpened(corpus);
      },
      (error: unknown) => {
        if (live) setUnopened(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return { opened, unopened };
}
