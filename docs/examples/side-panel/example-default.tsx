"use client";

import { useState } from "react";
import { Button, SidePanel } from "@kanzo-tech/ui";

export default function Example() {
  const [narrow, setNarrow] = useState(false);

  return (
    // A resolved height: the panel is a flex column and the docked variant takes its height
    // from the row it sits in, so an auto-height parent would collapse it to nothing.
    <div className="relative flex h-[280px] w-full overflow-hidden rounded-lg border bg-background">
      <SidePanel narrow={narrow} side="left" width={200}>
        <div className="flex flex-col gap-2 p-3 text-sm">
          <p className="font-medium">Explorer</p>
          <p className="text-muted-foreground text-xs">
            Docked at a fixed width. In narrow mode it becomes an overlay that slides in from
            its own edge.
          </p>
        </div>
      </SidePanel>

      <div className="flex-1 p-3">
        <Button onClick={() => setNarrow((v) => !v)} size="sm" variant="outline">
          {narrow ? "Dock it" : "Overlay it"}
        </Button>
      </div>
    </div>
  );
}
