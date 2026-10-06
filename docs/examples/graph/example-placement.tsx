"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, useGraphPrefs } from "@kanzo-tech/graph";
import { Pref, Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * Where the points come from, composed from the part: Force lets the layout place them, Map binds two
 * numeric columns — the archive has no coordinates, so `degree` against `reports` is a scatter — and
 * Clustered pulls a running layout together by a column. Each `<Pref>` draws itself only when its
 * declaration says so, and the column lists are the root's.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const { placement } = useGraphPrefs();
  return (
    <div className="flex h-[32rem] w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label" {...placement}>
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border p-3">
          <Pref name="graph.placement" />
          <Pref name="graph.x-by" />
          <Pref name="graph.y-by" />
          <Pref name="graph.cluster-by" />
          <Pref name="graph.cluster" />
        </div>
      </GraphRoot>
    </div>
  );
}
