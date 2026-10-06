"use client";

import { useState } from "react";
import { JsonTreeView, Switch, useDebouncedCommit } from "@kanzo-tech/ui";
import { Dashboard, type ChartConfig, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { CheckCircle2Icon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { MosaicDemo } from "../charts/mosaic-demo";

// A host's whole share of a dashboard: somewhere to keep the spec, a pause before writing it, a
// switch for who may edit, and the vocabulary of a field that has meanings of its own. The
// "server" is a variable here; in a product it is one row per relation behind a PUT.

/** `verdict` is a status: reserved colours, labels and icons, never colour alone. */
const CONFIG: Record<string, ChartConfig> = {
  verdict: {
    confirmed: { label: "Confirmed", color: "var(--success)", icon: CheckCircle2Icon },
    disputed: { label: "Disputed", color: "var(--warning)", icon: CircleHelpIcon },
    hoax: { label: "Hoax", color: "var(--destructive)", icon: TriangleAlertIcon },
  },
};

/** What the server returned for this relation. `undefined` would draw the automatic dashboard. */
const SAVED: DashboardSpec = {
  filters: [{ field: "region" }, { field: "verdict" }],
  tiles: [
    { id: "n", kind: "stat", span: 1, title: "Sightings", measure: { op: "count" }, trend: "hour" },
    {
      id: "hoax",
      kind: "stat",
      span: 2,
      title: "Hoaxes",
      measure: { op: "share", field: "verdict", equals: "hoax" },
      trend: "hour",
      goodWhenUp: false,
    },
    { id: "hour", kind: "chart", span: 2, type: "histogram", x: "hour", y: { op: "count" }, color: "verdict" },
    { id: "hall", kind: "chart", span: 1, type: "bar", x: "hall", y: { op: "count" }, color: "verdict" },
  ],
};

export default function Example() {
  const [stored, setStored] = useState<DashboardSpec | undefined>(SAVED);
  const [writes, setWrites] = useState(0);
  const [editable, setEditable] = useState(true);

  // Every edit lands in `draft` at once; the write happens after 800 ms without one, so dragging a
  // card through the layout is one request, not ten.
  const { draft, change } = useDebouncedCommit(stored, (next) => {
    setStored(next);
    setWrites((n) => n + 1);
  }, 800);

  return (
    <MosaicDemo>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Switch checked={editable} onCheckedChange={(d) => setEditable(d.checked)}>
            Editable
          </Switch>
          <span className="text-muted-foreground text-xs tabular-nums">
            {draft !== stored ? "Saving…" : writes === 0 ? "Loaded · no edits yet" : `Saved · ${writes} ${writes === 1 ? "write" : "writes"}`}
          </span>
        </div>
        <Dashboard
          config={CONFIG}
          onChange={editable ? change : undefined}
          rowNoun="sightings"
          table="sightings"
          value={draft}
        />
        {stored ? <JsonTreeView data={stored} defaultExpandedDepth={1} /> : null}
      </div>
    </MosaicDemo>
  );
}
