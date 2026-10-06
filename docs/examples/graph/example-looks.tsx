"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, useGraphPrefs } from "@kanzo-tech/graph";
import { PreferencesSections, Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * The graph's settings are its section, drawn whole: `PreferencesSections` writes `GRAPH_SECTION`,
 * `useGraphPrefs` reads it back as the look, the forces and the placement the root takes, and the
 * root answers the corpus's columns and the cards' pictures from where it stands. Which column wears
 * colour is a binding the host owns, and no preference changes it. The docs' provider registers
 * `GRAPH_SECTION`.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const { look, sim, placement } = useGraphPrefs();
  return (
    <div className="flex h-[32rem] w-full gap-3">
      <GraphRoot
        categories={ARCHIVE_KINDS}
        {...archive}
        fill="kind"
        look={look}
        onFailure={setFailure}
        r="degree"
        sim={sim}
        stroke="var(--muted-foreground)"
        title="label"
        {...placement}
      >
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border p-3">
          <PreferencesSections namespace="graph" />
        </div>
      </GraphRoot>
    </div>
  );
}
