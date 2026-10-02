"use client";

import { useState } from "react";
import { GraphCanvas, GraphRootProvider, useGraph, useGraphState } from "@kanzo-tech/graph";
import { Badge, Button, Show } from "@kanzo-tech/ui";
import { said, useArchive } from "./archive";

/** What is drawn, of what there is — a part that reads the slices it shows and nothing else. */
function Tally() {
  const drawn = useGraphState((s) => s.drawn);
  const total = useGraphState((s) => s.total);
  const status = useGraphState((s) => s.status);
  return (
    <Badge className="absolute top-2 left-2 tabular-nums" variant="secondary">
      <Show fallback={status} when={drawn !== null}>
        {drawn?.vertices.toLocaleString()} of {total?.toLocaleString()} · {status}
      </Show>
    </Badge>
  );
}

/**
 * `useGraph` builds the api where the host can hold it, and `GraphRootProvider` hands it to the
 * parts — `useDialog` and `DialogRootProvider`, one for one. The api is the commands and never
 * changes, so the button below is not re-rendered by a hover.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const api = useGraph({ ...archive, fill: "kind", r: "degree", title: "label", onFailure: setFailure });
  return (
    <div className="flex h-96 w-full flex-col gap-2">
      <Button className="self-start" onClick={() => api.fit()} size="sm" variant="outline">
        Fit to view
      </Button>
      <GraphRootProvider value={api}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Tally />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
      </GraphRootProvider>
    </div>
  );
}
