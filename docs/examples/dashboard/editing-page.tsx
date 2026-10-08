"use client";

import type { ReactNode } from "react";
import { ShellAside } from "@kanzo-tech/ui";
import { TileEditorAside, useTileEditorOpen } from "@kanzo-tech/ui/analytics";

/**
 * A page with an aside at its end edge, the way an app's shell has one: the board scrolls in its own
 * column, and the aside is shown while a tile is edited — draw.io's Format panel. The aside stays
 * mounted, because a page without a `TileEditorAside` offers no editing, and it sits under the
 * `MosaicProvider`, whose context the dashboard reaches it through.
 */
export function EditingPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[48rem] w-full overflow-hidden rounded-lg border">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">{children}</div>
      <ShellAside aria-label="Format" className="bg-card" hidden={!useTileEditorOpen()} side="end" width={352}>
        <TileEditorAside />
      </ShellAside>
    </div>
  );
}
