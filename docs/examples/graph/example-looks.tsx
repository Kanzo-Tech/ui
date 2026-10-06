"use client";

import { useState } from "react";
import { GraphCanvas, GraphLooks, GraphRoot, useGraphPrefs } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * Change an axis and the canvas follows: `GraphLooks` writes the section's axes and `useGraphPrefs`
 * reads them back as the `look` the root takes. Which column wears colour is a binding the host owns,
 * and it does not change with the look. The docs' provider registers `GRAPH_SECTION`.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const { look, sim } = useGraphPrefs();
  return (
    <div className="flex h-[32rem] w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" look={look} onFailure={setFailure} r="degree" sim={sim} stroke="var(--muted-foreground)" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
      <GraphLooks className="w-64 shrink-0 overflow-y-auto rounded-lg border p-3" />
    </div>
  );
}
