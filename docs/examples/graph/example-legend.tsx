"use client";

import { useState } from "react";
import { GraphCanvas, GraphLegend, GraphRoot } from "@kanzo-tech/graph";
import { Show, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/**
 * The legend draws the scale the canvas draws. `categories` on the root names `kind`'s values, and
 * their order is the rank — so a colour is decided before the graph loads and never changes hands.
 * Bound to `cluster_id`, which nothing names, the values rank as they sort, and past the palette's
 * capacity they are Other.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const [fill, setFill] = useState("kind");
  return (
    <div className="flex h-96 w-full flex-col gap-3">
      <ToggleGroup
        aria-label="Colour by"
        multiple={false}
        onValueChange={(details) => setFill(details.value[0] ?? "kind")}
        size="sm"
        value={[fill]}
        variant="outline"
      >
        <ToggleGroupItem value="kind">kind</ToggleGroupItem>
        <ToggleGroupItem value="cluster_id">cluster_id</ToggleGroupItem>
        <ToggleGroupItem value="var(--foreground)">one ink</ToggleGroupItem>
      </ToggleGroup>
      <GraphRoot categories={ARCHIVE_KINDS} {...archive} fill={fill} onFailure={setFailure} r="degree" title="label">
        <GraphCanvas className="flex-1 rounded-lg border">
          <GraphLegend className="absolute start-2 bottom-2" />
          <Show when={failure !== null}>
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
          </Show>
        </GraphCanvas>
      </GraphRoot>
    </div>
  );
}
