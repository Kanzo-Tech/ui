"use client";

import { useState } from "react";
import { GraphCanvas, GraphRoot, useGraphContext, type Tool } from "@kanzo-tech/graph";
import { Alert, AlertDescription, Badge, Show, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";
import { LassoIcon, SquareDashedIcon } from "lucide-react";
import { useArchive } from "./archive";

/** The tool and the selection, as parts: each reads the root's context and draws one thing. */
function Tools() {
  const { selection, setTool, tool } = useGraphContext();
  return (
    <div className="absolute top-2 left-2 flex items-center gap-2">
      <ToggleGroup
        aria-label="Selection tool"
        multiple={false}
        onValueChange={(details) => setTool((details.value[0] as Tool) ?? null)}
        size="sm"
        value={tool === null ? [] : [tool]}
        variant="outline"
      >
        <ToggleGroupItem aria-label="Marquee" value="rect">
          <SquareDashedIcon />
        </ToggleGroupItem>
        <ToggleGroupItem aria-label="Lasso" value="lasso">
          <LassoIcon />
        </ToggleGroupItem>
      </ToggleGroup>
      <Show when={selection !== null}>
        <Badge variant="secondary">
          {selection?.label}: {selection?.vertices.length}
        </Badge>
      </Show>
    </div>
  );
}

/**
 * The canvas's own overlays over the archive: the dot grid locked to the graph's space, standing
 * labels on the biggest vertices — their text is the `title` column, read with the tile — a hover
 * card, and a drag that selects. Shift borrows the marquee whichever tool is armed; at release `Alt`
 * removes what was drawn and `⌘`/`Ctrl` adds.
 */
export default function Example() {
  const { corpus, unopened } = useArchive();
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <div className="h-96 w-full">
      <Show
        fallback={
          <Alert variant="destructive">
            <AlertDescription>{unopened ?? failure}</AlertDescription>
          </Alert>
        }
        when={unopened === null && failure === null}
      >
        <GraphRoot corpus={corpus} fill="kind" onFailure={setFailure} r="degree" title="label">
          <GraphCanvas className="rounded-lg border">
            <Tools />
          </GraphCanvas>
        </GraphRoot>
      </Show>
    </div>
  );
}
