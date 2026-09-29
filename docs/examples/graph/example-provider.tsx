"use client";

import { useState } from "react";
import { GraphCanvas, GraphRootProvider, useGraph, useGraphContext } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show } from "@kanzo-tech/ui";
import { useArchive } from "./archive";

/** What is drawn, of what there is — read from the context by a part inside the canvas. */
function Tally() {
  const { drawn, pending, total, z } = useGraphContext();
  return (
    <Badge className="absolute top-2 left-2 tabular-nums" variant="secondary">
      <Show fallback="reading…" when={drawn !== null}>
        {drawn?.marks.toLocaleString()} marks for {drawn?.represented.toLocaleString()} of {total?.toLocaleString()} · z{" "}
        {z}
        {pending ? " · reading" : ""}
      </Show>
    </Badge>
  );
}

/**
 * `useGraph` builds the api where the host can hold it, and `GraphRootProvider` hands it to the
 * parts — `useDialog` and `DialogRootProvider`, one for one.
 */
export default function Example() {
  const { corpus, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  const api = useGraph({ corpus, fill: "kind", r: "degree", onFailure: setFailure });
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
          <GraphCanvas className="rounded-lg border">
            <Tally />
          </GraphCanvas>
        </GraphRootProvider>
      </Show>
    </div>
  );
}
