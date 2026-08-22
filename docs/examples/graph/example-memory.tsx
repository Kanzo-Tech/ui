"use client";

import { useMemo, useState } from "react";
import {
  GraphRootProvider,
  memorySource,
  useGraph,
  useGraphContext,
} from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show } from "@kanzo-tech/ui";
import { sightingsGraph } from "@/lib/sightings-graph";

/**
 * The same canvas with no database at all — arrays in hand, wrapped in `memorySource`.
 *
 * It draws the sightings fixture as the graph it already is: every report joined to the beast it
 * names and the region it happened in, so the beasts and the regions are **hubs**. That is the one
 * thing a graph shows that the crossfilter charts over the same rows cannot — pull on one arc and
 * you get the reports of a beast across every region at once.
 *
 * And it is the `useGraph` + `GraphRootProvider` shape rather than `GraphCanvas`, because the count
 * below is read from `useGraphContext()` and a component that renders the root sits *above* the
 * provider, where no context is readable.
 *
 * **This is not the first example, and that is the point.** `example-default` used to be an
 * arrays-in-hand one and was deliberately replaced by the corpus: a first example that hands the
 * package three typed arrays teaches an API no product uses. So the corpus opens the page and this
 * sits under the sentence that names `memorySource` — the path for a host whose graph already fits
 * in hand. Restoring it as the first example would undo that argument rather than continue it.
 *
 * The arrays themselves are `@/lib/sightings-graph`, because three examples on this page draw the
 * same graph and the whole point of the other two is that they are this one wearing different
 * chrome. How you fill a `Float32Array` is generic; what `memorySource` asks for is the composition
 * below.
 */

/** A child of the provider, because that is the only place the context is readable. */
function Tally() {
  const { slice } = useGraphContext();

  // `marks` of `n`, never `marks` alone: `n` is what the window matched before `limit` cut it, and a
  // truncated answer that reads like a complete one is the one thing a bounded view owes its reader
  // not to do.
  return (
    <Badge className="absolute top-2 left-2" variant="secondary">
      <Show fallback="asking…" when={slice !== null}>
        {slice?.marks} drawn of {slice?.n}
      </Show>
    </Badge>
  );
}

export default function Example() {
  const graph = useMemo(sightingsGraph, []);
  const source = useMemo(() => memorySource(graph), [graph]);
  const [failure, setFailure] = useState<string | null>(null);

  const api = useGraph({ source, onFailure: (error) => setFailure(String(error)) });

  return (
    <div className="h-96 w-full">
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        }
        when={failure === null}
      >
        <GraphRootProvider value={api}>
          <Tally />
        </GraphRootProvider>
      </Show>
    </div>
  );
}
