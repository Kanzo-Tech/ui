"use client";

import { useState } from "react";
import { GraphCanvas, GraphLooks, GraphRoot, useGraphPrefs } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * Pick a look and the canvas follows: `GraphLooks` writes the section's axes, `useGraphPrefs` reads
 * them back as the `look` the root takes, and `preset` says which look they are — so Ink can be paired
 * with identity on shape, a binding the host owns. The docs' provider registers `GRAPH_SECTION`.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const { look, sim, preset } = useGraphPrefs();
  const channels = preset === "ink" ? { fill: "var(--foreground)", symbol: "kind" } : { fill: "kind" };
  return (
    <div className="flex h-[32rem] w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} look={look} onFailure={setFailure} r="degree" sim={sim} title="label" {...channels}>
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
