"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { useArchive } from "./archive";

/**
 * The whole of it: the corpus fossil opened, handed to `GraphRoot`, drawn by `GraphCanvas`. Until
 * the archive has opened the root is given `null` and the canvas waits over an empty surface.
 */
export default function Example() {
  const { corpus, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-border bg-card">
      <GraphRoot corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas>
          <Show when={unopened !== null || failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">
              {unopened ?? failure}
            </p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
