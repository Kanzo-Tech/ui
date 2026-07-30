"use client";

import { QUESTS } from "@/example/quests";
import { Toggle } from "@kanzo-tech/ui";
import { ClockIcon, PawPrintIcon, ScrollTextIcon } from "lucide-react";
import { useState } from "react";

/**
 * The board's filter strip — controlled, so the pressed state is the actual filter, not just a
 * visual. This is what a Toggle is for; a lone unbound one demonstrates the API but not the use.
 */
export default function Example() {
  const [filters, setFilters] = useState({ open: true, overdue: false, beast: false });
  const toggle = (k: keyof typeof filters) => (pressed: boolean) =>
    setFilters((f) => ({ ...f, [k]: pressed }));

  const matching = QUESTS.filter(
    (contract) =>
      (!filters.open || contract.status === "open") &&
      (!filters.overdue || contract.dueDayOffset < 0) &&
      (!filters.beast || contract.beast !== undefined),
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <Toggle aria-label="Open only" onPressedChange={toggle("open")} pressed={filters.open}>
          <ScrollTextIcon />
        </Toggle>
        <Toggle
          aria-label="Past its due date"
          onPressedChange={toggle("overdue")}
          pressed={filters.overdue}
        >
          <ClockIcon />
        </Toggle>
        <Toggle
          aria-label="Has a beast"
          onPressedChange={toggle("beast")}
          pressed={filters.beast}
        >
          <PawPrintIcon />
        </Toggle>
      </div>

      <p className="text-muted-foreground text-sm">
        {matching.length} of {QUESTS.length} contracts
      </p>
    </div>
  );
}
