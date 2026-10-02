"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { said, useArchive } from "./archive";

/**
 * The whole of it: the catalog fossil attached, named to `GraphRoot` with the page's coordinator and
 * drawn by `GraphCanvas`. Nothing binds `x` and `y`, so the layout runs from a seeded start.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-border bg-card">
      <GraphRoot {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas>
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
