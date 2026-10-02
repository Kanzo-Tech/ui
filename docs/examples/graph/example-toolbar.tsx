"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, GraphToolbar } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * The toolbar is the commands, drawn: arm the marquee or the lasso and drag, and the selection
 * cluster appears with what it holds, a frame and a clear. The canvas draws the rest itself — the
 * grid, standing labels on the biggest vertices from the `title` column, the hover card and the
 * drag. Shift borrows the marquee whichever tool is armed; at release `Alt` removes what was drawn
 * and `⌘`/`Ctrl` adds.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  return (
    <div className="h-96 w-full">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="rounded-lg border">
          <GraphToolbar className="absolute end-2 top-2" />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
