"use client";

import { useState, type ReactNode } from "react";
import {
  GraphCanvas,
  GraphCounts,
  GraphInspector,
  GraphLegend,
  GraphRoot,
  GraphSearch,
  GraphStatus,
  GraphToolbar,
  useGraphPrefs,
} from "@kanzo-tech/graph";
import { Kbd, KbdGroup, PreferencesSections, ScrollArea, Show, Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { ARCHIVE_KINDS, said, useArchive } from "./archive";

/** What each gesture does — the canvas's, written down once by the host. */
const GESTURES: { keys: ReactNode; what: string }[] = [
  { keys: <Kbd>Drag</Kbd>, what: "Pan — or move a node" },
  { keys: <Kbd>Wheel</Kbd>, what: "Zoom where you point" },
  { keys: <Kbd>Click</Kbd>, what: "Focus a node with its neighbours" },
  {
    keys: (
      <KbdGroup>
        <Kbd>Shift</Kbd>
        <Kbd>Drag</Kbd>
      </KbdGroup>
    ),
    what: "Marquee, without picking a tool",
  },
  { keys: <Kbd>⌘ / Ctrl</Kbd>, what: "Add what you draw" },
  { keys: <Kbd>Alt</Kbd>, what: "Remove what you draw" },
  { keys: <Kbd>Esc</Kbd>, what: "Back out: the drag, the tool, the selection" },
];

/**
 * The discovery workspace in miniature: one `GraphRoot` around the canvas with its toolbar and
 * legend, a dock with an Info panel (search over the inspector) and a Settings panel (the looks and
 * the gestures), and the counts in the footer. Every part reads the one root, so a search reveals on
 * the canvas and a look repaints it.
 */
export default function Example() {
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchive(setFailure);
  const { look, sim, placement } = useGraphPrefs();
  return (
    <div className="flex h-[34rem] w-full flex-col overflow-hidden rounded-lg border">
      <GraphRoot
        categories={ARCHIVE_KINDS}
        {...archive}
        fill="kind"
        look={look}
        onFailure={setFailure}
        r="degree"
        sim={sim}
        stroke="var(--muted-foreground)"
        title="label"
        {...placement}
      >
        <div className="flex min-h-0 flex-1">
          <GraphCanvas className="min-w-0 flex-1">
            <GraphToolbar className="absolute end-2 top-2 z-10" orientation="vertical" />
            <GraphLegend className="absolute start-2 bottom-2 z-10" />
            <Show when={failure !== null}>
              <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">{said(failure)}</p>
            </Show>
          </GraphCanvas>
          <Tabs className="flex w-64 shrink-0 flex-col gap-0 border-s bg-card" defaultValue="info">
            <TabsList className="m-2">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3" value="info">
              <GraphSearch />
              <ScrollArea className="min-h-0 flex-1">
                <GraphInspector />
              </ScrollArea>
            </TabsContent>
            <TabsContent className="min-h-0 flex-1" value="settings">
              <ScrollArea className="h-full px-3 pb-3">
                <PreferencesSections namespace="graph" />
                <p className="mt-4 mb-2 font-medium text-muted-foreground text-xs">Gestures</p>
                <dl className="space-y-1.5">
                  {GESTURES.map((gesture) => (
                    <div className="flex items-baseline gap-2" key={gesture.what}>
                      <dt className="shrink-0">{gesture.keys}</dt>
                      <dd className="text-[11px] text-muted-foreground leading-snug">{gesture.what}</dd>
                    </div>
                  ))}
                </dl>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        <footer className="flex items-center gap-2 border-t px-3 py-1.5">
          <GraphStatus />
          <GraphCounts />
        </footer>
      </GraphRoot>
    </div>
  );
}
