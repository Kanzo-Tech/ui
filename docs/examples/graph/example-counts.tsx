"use client";

import { useState } from "react";
import { GraphCanvas, GraphCounts, GraphLegend, GraphRoot, GraphStatus } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * The legend keys the categories and the counts say how much of the corpus there is and how much
 * of it the filter keeps: two parts, so a host puts the sentence in a footer and the key over the
 * canvas. `GraphStatus` beside the sentence is where the graph is, in one word.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  return (
    <div className="flex h-96 w-full flex-col gap-2">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <GraphLegend className="absolute start-2 bottom-2" />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <div className="flex items-center gap-2">
          <GraphStatus />
          <GraphCounts />
        </div>
      </GraphRoot>
    </div>
  );
}
