"use client";

import { DatabaseIcon, ListIcon, MaximizeIcon, TriangleAlertIcon } from "lucide-react";
import {
  Badge,
  Button,
  PanelHeader,
  WorkspaceFloatingControls,
  WorkspaceLayout,
  WorkspaceStatusStart,
} from "@kanzo-tech/ui";

const panels = [
  {
    id: "outline",
    icon: <ListIcon />,
    label: "Outline",
    content: (
      <>
        <PanelHeader title="Outline" />
        <ul className="space-y-1 p-3 text-muted-foreground text-xs">
          <li>dct:title</li>
          <li>dct:issued</li>
          <li>dcat:keyword</li>
        </ul>
      </>
    ),
  },
  {
    id: "issues",
    icon: <TriangleAlertIcon />,
    label: "Issues",
    content: (
      <>
        <PanelHeader title="Issues" />
        <div className="flex items-start gap-2 p-3">
          <Badge size="xs" variant="warning">
            warn
          </Badge>
          <span className="text-muted-foreground text-xs">
            <code>.keywords[]</code> has no declared datatype.
          </span>
        </div>
      </>
    ),
  },
  {
    id: "preview",
    icon: <DatabaseIcon />,
    label: "Preview",
    content: (
      <>
        <PanelHeader title="Preview" />
        <div className="p-3 font-mono text-muted-foreground text-xs">
          21 vertices · 61 edges
        </div>
      </>
    ),
  },
];

export default function Example() {
  return (
    // WorkspaceLayout sizes itself with `height: 100%`, and a percentage against an
    // auto-height parent falls back to auto — which collapses the splitter and the canvas to
    // content height. So the wrapper resolves a height.
    <div className="h-[420px] w-full overflow-hidden rounded-lg border bg-background">
      {/* Toggle the dock with ⌘/Ctrl+\, close it with Escape, drag the divider to resize. */}
      <WorkspaceLayout panels={panels} storageKey="kz:docs-workspace-example">
        <div className="flex h-full items-center justify-center bg-muted/30 text-muted-foreground text-sm">
          canvas
        </div>

        {/* Anchored to the canvas because it acts ON the canvas. Navigation does not go
            here — it belongs in the page chrome where it cannot cover the content. */}
        <WorkspaceFloatingControls>
          <Button aria-label="Fit to screen" size="icon-sm" variant="outline">
            <MaximizeIcon />
          </Button>
        </WorkspaceFloatingControls>

        {/* Portals into the status bar WorkspaceLayout owns. */}
        <WorkspaceStatusStart>
          <span>aemet.fossil · 1,204 triples</span>
        </WorkspaceStatusStart>
      </WorkspaceLayout>
    </div>
  );
}
