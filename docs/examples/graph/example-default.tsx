"use client";

import { useEffect, useState } from "react";
import { GraphCanvas } from "@kanzo-tech/graph";
import { openCorpus, type DuckSource } from "@kanzo-tech/graph/duckdb";
import { Coordinator, wasmConnector } from "@kanzo-tech/ui/analytics";
import { Show, Skeleton } from "@kanzo-tech/ui";

/**
 * The archive the workspace showcase draws, drawn by the smallest host that can.
 *
 * **This example got bigger, and the page says so.** It used to be arrays in hand and one call —
 * no database, no corpus, nothing to build. What it demonstrated was a path no product takes: the
 * package reads a corpus, and a first example that hands it three typed arrays teaches an API that
 * is not the one you would use. So it boots DuckDB-WASM and opens the same
 * `docs/public/corpus/archive` the workspace does — one world, not two.
 *
 * Four things and no more: a coordinator, where the corpus is, a source, and `onFailure`. The
 * simulation stays off — its default — because the positions are the corpus' own layout and a force
 * would move the picture out from under the index the next query is expressed in.
 *
 * No `MosaicProvider` here: it registers its coordinator as vgplot's process-wide active one, and
 * nothing on this page draws a chart. The source holds the coordinator it queries through.
 */
const CORPUS = "/corpus/archive";

let opening: Promise<DuckSource> | null = null;

function open(): Promise<DuckSource> {
  opening ??= (async () => {
    const coordinator = new Coordinator(wasmConnector());
    // Origin-qualified: DuckDB-WASM resolves a root-relative path against its own virtual
    // filesystem rather than the page's origin, and finds nothing there.
    const { source } = await openCorpus({
      coordinator,
      dest: `${window.location.origin}${CORPUS}`,
    });
    return source;
  })();
  return opening;
}

export default function Example() {
  const [source, setSource] = useState<DuckSource | null>(null);
  // Two failures, because they fail at different times: one is the corpus not opening, which
  // replaces the canvas; the other is the canvas having no WebGL, which draws over it.
  const [unopened, setUnopened] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    open().then(
      (opened) => {
        if (live) setSource(opened);
      },
      // The corpus is gitignored, so "not readable" is what a fresh checkout sees, and saying it is
      // better than a spinner that never resolves.
      (error: unknown) => {
        if (live) setUnopened(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (unopened !== null) {
    return (
      <p className="grid h-80 place-items-center rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
        {unopened}
      </p>
    );
  }
  if (source === null) return <Skeleton className="h-80 w-full" />;

  return (
    <GraphCanvas
      className="rounded-lg border border-border bg-card"
      fill="kind"
      onFailure={setFailure}
      source={source}
    >
      <Show when={failure !== null}>
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">
          {failure}
        </p>
      </Show>
    </GraphCanvas>
  );
}
