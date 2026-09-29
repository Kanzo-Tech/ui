"use client";

import { useState } from "react";
import {
  GraphCanvas,
  GraphInspector,
  GraphRoot,
  type VertexDetail,
} from "@kanzo-tech/graph";
import { DataListItem, DataListItemLabel, DataListItemValue, Show } from "@kanzo-tech/ui";
import { HALLS } from "@/example/world";
import { ARCHIVE_KINDS, useArchive } from "./archive";

/** A field the corpus does not carry: the hall's name, where the relation stores its id. */
function HallName({ detail }: { detail: VertexDetail }) {
  const id = detail.fields.find((field) => field.name === "hall")?.value;
  return (
    <DataListItem className="gap-0.5 py-0">
      <DataListItemLabel className="text-xs">hall name</DataListItemLabel>
      <DataListItemValue>{HALLS.find((hall) => hall.id === id)?.name ?? "shared across the halls"}</DataListItemValue>
    </DataListItem>
  );
}

/**
 * Click a vertex. The inspector reads its row — one payload tile, filtered to it — and lays it out by
 * the corpus's own fields; its `children` is a render prop for a field the product adds. It sits
 * outside the canvas because it is a part of the root, not of the canvas.
 */
export default function Example() {
  const corpus = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="flex h-96 w-full gap-3">
      <GraphRoot categories={ARCHIVE_KINDS} corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{failure}</p>
          </Show>
        </GraphCanvas>
        <GraphInspector className="w-56 shrink-0 overflow-y-auto rounded-lg border p-3">
          {(detail) => <HallName detail={detail} />}
        </GraphInspector>
      </GraphRoot>
    </div>
  );
}
