"use client";

import { useState } from "react";
import { GraphCanvas, GraphPlacement, GraphRoot, type Channels } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * Where the points come from, as cards: Force lets the layout place them, Map binds two numeric
 * columns — the archive has no coordinates, so `degree` against `reports` is a scatter — and
 * Clustered pulls a running layout together by `hall`. The placement is the host's state, handed to
 * the root as it is.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const [placement, setPlacement] = useState<Pick<Channels, "x" | "y" | "cluster">>({});
  return (
    <div className="flex h-[32rem] w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label" {...placement}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <GraphPlacement className="w-64 shrink-0 overflow-y-auto rounded-lg border p-3" onChange={setPlacement} value={placement} />
      </GraphRoot>
    </div>
  );
}
