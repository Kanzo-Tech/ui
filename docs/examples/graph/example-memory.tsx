"use client";

import { useState } from "react";
import { GraphRootProvider, useGraph, useGraphContext } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show } from "@kanzo-tech/ui";
import { useArchive } from "@/lib/archive-corpus";

/**
 * The same archive, drawn by the **api** rather than by the component — and the count that needs it.
 *
 * `GraphCanvas` is `useGraph` and `GraphRootProvider` in one call, and it is what you want until
 * something has to read the graph from *above* the element. The badge is that something: it reads
 * `slice` off `useGraphContext()`, so it has to be a child of the provider, and a component that
 * renders the provider sits above it where no context is readable. Hence the two pieces.
 *
 * **This example used to be the one with no database at all** — three typed arrays wrapped in
 * `memorySource`, the cheapest thing on the page. That source is deleted: this package sends one
 * source and it reads a corpus, so an arrays-in-hand example taught an API no product takes. What
 * the example is about did not change, because it was never the arrays; it was the two pieces and
 * the honest count.
 *
 * `marks` **of** `n`, never `marks` alone: `n` is what the window matched before `limit` cut it, and
 * a truncated answer that reads like a complete one is the one thing a bounded view owes its reader
 * not to do. Over the whole archive the two agree — 1,543 vertices is under the limit, so the source
 * is asked once for everything — and they part the moment a window holds more than it can draw.
 */

/** A child of the provider, because that is the only place the context is readable. */
function Tally() {
  const { slice } = useGraphContext();

  return (
    <Badge className="absolute top-2 left-2" variant="secondary">
      <Show fallback="asking…" when={slice !== null}>
        {slice?.marks} drawn of {slice?.n}
      </Show>
    </Badge>
  );
}

export default function Example() {
  const { opened, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);

  const api = useGraph({
    // `null` until the manifests have been read, which the api takes: a graph with no source asks
    // nothing and draws nothing, rather than this component holding two shapes of itself.
    source: opened?.source ?? null,
    fill: "kind",
    r: "degree",
    onFailure: (error) => setFailure(String(error)),
  });

  return (
    <div className="h-96 w-full">
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{unopened ?? failure}</AlertDescription>
          </Alert>
        }
        when={unopened === null && failure === null}
      >
        <GraphRootProvider value={api}>
          <Tally />
        </GraphRootProvider>
      </Show>
    </div>
  );
}
