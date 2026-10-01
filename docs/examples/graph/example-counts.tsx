"use client";

import { useState } from "react";
import { GraphCanvas, GraphCounts, GraphLegend, GraphRoot } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, useArchive } from "./archive";

/**
 * The legend keys the categories and the counts say what is drawn of the whole: two parts, so a host
 * puts the sentence in a footer and the key over the canvas. `spinner` draws progress beside the
 * sentence for a host with no status of its own.
 */
export default function Example() {
  const corpus = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="flex h-96 w-full flex-col gap-2">
      <GraphRoot categories={ARCHIVE_KINDS} corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <GraphLegend className="absolute start-2 bottom-2" />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{failure}</p>
          </Show>
        </GraphCanvas>
        <GraphCounts spinner />
      </GraphRoot>
    </div>
  );
}
