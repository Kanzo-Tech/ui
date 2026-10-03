"use client";

import { useState } from "react";
import { GraphCanvas, GraphInspector, GraphRoot, GraphSearch } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * Type a name, or narrow it — `kind:beast`, or a vertex type with `type:`. Each pause asks the corpus
 * once; the matches come back grouped by type and named by `categories`, and picking one reveals it,
 * the inspector reads it, and the empty palette lists it under Recent. ⌘K moves here.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  return (
    <div className="flex h-96 w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <div className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3">
          <GraphSearch placeholder="Find in the archive… try kind:beast" />
          <GraphInspector className="min-h-0 overflow-y-auto" />
        </div>
      </GraphRoot>
    </div>
  );
}
