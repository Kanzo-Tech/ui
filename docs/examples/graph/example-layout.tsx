"use client";

import { useState } from "react";
import { GraphCanvas, GraphCounts, GraphRoot, GraphToolbar, useGraphState } from "@kanzo-tech/graph";
import { Badge, Progress, Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/** The two axes, side by side: the data's `status` and the layout's `motion`, with `progress` and the pins. */
function Readout() {
  const status = useGraphState((s) => s.status);
  const motion = useGraphState((s) => s.motion);
  const progress = useGraphState((s) => s.progress);
  const pinned = useGraphState((s) => s.pinned.length);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="outline">status · {status}</Badge>
      <Badge variant={motion === "running" ? "default" : "outline"}>motion · {motion}</Badge>
      <Badge variant="outline">{pinned} pinned</Badge>
      <div className="w-32">
        <Progress aria-label="Layout progress" value={Math.round(progress * 100)} />
      </div>
    </div>
  );
}

/**
 * Press play: `motion` goes to `running` and `progress` climbs while `status` stays `idle`, because
 * nothing is being read. Drag a node while it runs and it stays where you drop it; the toolbar then
 * offers to release the pins. The camera follows the moving points until you zoom or pan.
 */
export default function Example() {
  const corpus = useArchive();
  const [failure, setFailure] = useState<unknown>(null);
  return (
    <div className="flex h-96 w-full flex-col gap-2">
      <GraphRoot categories={ARCHIVE_KINDS} corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <Readout />
        <GraphCanvas className="flex-1 rounded-lg border">
          <GraphToolbar className="absolute end-2 top-2" />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <GraphCounts spinner />
      </GraphRoot>
    </div>
  );
}
