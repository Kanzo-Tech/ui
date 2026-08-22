"use client";

import { useState } from "react";
import { Button, ButtonGroup } from "@kanzo-tech/ui";
import { WorkspaceColumns, type WorkspaceColumn } from "@/showcases/shared";

const PANE = (title: string, body: string) => (
  <div className="flex h-full flex-col gap-1 bg-card p-3">
    <span className="font-medium text-xs">{title}</span>
    <span className="text-muted-foreground text-xs">{body}</span>
  </div>
);

const ALL: WorkspaceColumn[] = [
  { id: "orders", minSize: 15, node: PANE("Standing orders", "What the hall will and will not take.") },
  { id: "ledger", minSize: 30, node: PANE("The ledger", "One row per slip, read off the shape.") },
  { id: "findings", minSize: 15, node: PANE("Findings", "Every cell the validator flagged.") },
];

export default function Example() {
  const [open, setOpen] = useState(["orders", "ledger", "findings"]);
  const columns = ALL.filter((column) => open.includes(column.id));

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Closing a column is what the block's `key` exists for: drag a seam, close a panel, and
          the remaining seam still resizes the pair it is actually between. */}
      <ButtonGroup aria-label="Which columns are open">
        {ALL.map((column) => (
          <Button
            aria-pressed={open.includes(column.id)}
            key={column.id}
            onClick={() =>
              setOpen((was) =>
                was.includes(column.id)
                  ? was.filter((id) => id !== column.id)
                  : ALL.filter((c) => was.includes(c.id) || c.id === column.id).map((c) => c.id),
              )
            }
            size="sm"
            variant={open.includes(column.id) ? "default" : "outline"}
          >
            {column.id}
          </Button>
        ))}
      </ButtonGroup>

      <div className="h-48 w-full overflow-hidden rounded-lg border">
        <WorkspaceColumns
          columns={columns}
          // One entry per column, always: the block remounts the splitter on the open set, and a
          // `defaultSize` of three handed to a row of two describes a row that is not there.
          defaultSize={columns.map(() => 100 / columns.length)}
        />
      </div>
    </div>
  );
}
