"use client";

import { ListChecksIcon, ScrollIcon, TableIcon } from "lucide-react";
import { useState } from "react";
import { PanelRail, type RailPanel } from "@/showcases/shared";

const PANELS: RailPanel[] = [
  { icon: ScrollIcon, label: "Standing orders", value: "orders" },
  { icon: TableIcon, label: "The ledger", value: "ledger" },
  { icon: ListChecksIcon, label: "Findings", value: "findings" },
];

export default function Example() {
  const [open, setOpen] = useState<string[]>(["ledger"]);

  return (
    // The rail is a `ShellAside`, so it wants a row to sit at the edge of and a height to fill.
    <div className="flex h-64 w-full max-w-md overflow-hidden rounded-lg border">
      <PanelRail label="Panels" onValueChange={setOpen} panels={PANELS} value={open} />
      <div className="flex min-w-0 flex-1 items-center justify-center bg-background p-4 text-center text-muted-foreground text-sm">
        {open.length === 0
          ? "Nothing open."
          : `Open: ${open
              .map((value) => PANELS.find((panel) => panel.value === value)?.label)
              .join(" · ")}`}
      </div>
    </div>
  );
}
