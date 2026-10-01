"use client";

import { useState } from "react";
import { GraphCanvas, GraphInspector, GraphRoot, GraphSearch } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, useArchive } from "./archive";

/**
 * Type a name. Every vertex's `title` was read once, so the list filters in the browser, hubs first
 * by the `r` ramp, each named by `categories`; picking one reveals it and the inspector reads it.
 */
export default function Example() {
  const corpus = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="flex h-96 w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{failure}</p>
          </Show>
        </GraphCanvas>
        <div className="flex w-60 shrink-0 flex-col gap-3 rounded-lg border p-3">
          <GraphSearch placeholder="Find in the archive…" />
          <GraphInspector className="min-h-0 overflow-y-auto" />
        </div>
      </GraphRoot>
    </div>
  );
}
