"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, GraphSelect } from "@kanzo-tech/graph";
import { numbers, Query, type Coordinator } from "@kanzo-tech/ui/analytics";
import { Show } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, FROM, said, useArchive } from "./archive";

const KINDS = ["beast", "region", "tag"] as const;

/**
 * Three offers a panel makes — *these vertices, on the canvas*. Each reads its ids when pressed,
 * and is pressed while the live selection is the one it made: lasso something and it lets go.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const idsOf = (coordinator: Coordinator, kind: string) => async () =>
    numbers(
      await coordinator.query(Query.from(`"${FROM}"."Node"`).select({ id: "dense_id" }).where(`kind = '${kind}'`)),
      "id",
    );
  return (
    <div className="flex h-96 w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
        <div className="flex w-48 shrink-0 flex-col gap-2">
          {KINDS.map((kind) => (
            <GraphSelect
              disabled={!archive.coordinator}
              key={kind}
              label={`Every ${ARCHIVE_KINDS[kind].toLowerCase()}`}
              load={archive.coordinator ? idsOf(archive.coordinator, kind) : async () => []}
            >
              <span className="text-sm">Every {ARCHIVE_KINDS[kind].toLowerCase()}</span>
            </GraphSelect>
          ))}
        </div>
      </GraphRoot>
    </div>
  );
}
