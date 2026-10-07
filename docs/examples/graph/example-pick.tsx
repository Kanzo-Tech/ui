"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, usePick } from "@kanzo-tech/graph";
import { numbers, Query, type Coordinator } from "@kanzo-tech/ui/analytics";
import { Show, Toggle } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, FROM, said, useArchive } from "./archive";

const KINDS = ["beast", "region", "tag"] as const;

/**
 * A panel beside the canvas that picks *every vertex of a kind*. It is one place, so picking another
 * kind replaces its pick; the canvas greys out the rest, and a lasso intersects with it.
 */
function Kinds({ coordinator }: { coordinator: Coordinator | null }) {
  const kinds = usePick("kinds");
  const pick = async (kind: (typeof KINDS)[number], label: string) => {
    if (!coordinator) return;
    const query = Query.from(`"${FROM}"."Node"`).select({ id: "dense_id" }).where(`kind = '${kind}'`);
    kinds.pick(numbers(await coordinator.query(query), "id"), label);
  };
  return (
    <div className="flex w-48 shrink-0 flex-col gap-2">
      {KINDS.map((kind) => {
        const label = `Every ${ARCHIVE_KINDS[kind].toLowerCase()}`;
        return (
          <Toggle
            disabled={!coordinator}
            key={kind}
            onPressedChange={(pressed) => (pressed ? void pick(kind, label) : kinds.pick(null, label))}
            pressed={kinds.picked === label}
            variant="outline"
          >
            {label}
          </Toggle>
        );
      })}
    </div>
  );
}

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
        <Kinds coordinator={archive.coordinator} />
      </GraphRoot>
    </div>
  );
}
