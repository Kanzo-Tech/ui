"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { useArchive } from "./archive";

/**
 * The whole of it: the opening of the corpus fossil reads, handed to `GraphRoot`, drawn by
 * `GraphCanvas`. The canvas says it is opening, then reading, until the tiles in view are drawn.
 */
export default function Example() {
  const corpus = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-border bg-card">
      <GraphRoot corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas>
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{failure}</p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
