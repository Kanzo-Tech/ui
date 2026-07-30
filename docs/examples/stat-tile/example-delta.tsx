"use client";

import { StatTile } from "@kanzo-tech/ui";
import { boardValue, overdueQuests, QUESTS } from "@/example/quests";
import { availableNow } from "@/example/roster";

const settled = QUESTS.filter((contract) => contract.status === "settled").length;

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* Up is good here: more members ready is more members ready. */}
      <StatTile
        delta={{ value: 2, label: "vs last week" }}
        label="Members ready"
        value={availableNow().length}
      />
      {/* And here it is not — same green/red vocabulary, opposite meaning. */}
      <StatTile
        delta={{ value: 1, label: "vs last week", goodWhenUp: false }}
        label="Contracts overdue"
        value={overdueQuests().length}
      />
      <StatTile
        delta={{ value: -140, unit: " gold", label: "vs last week", goodWhenUp: false }}
        label="Unclaimed on the board"
        value={boardValue("open")}
      />
      <StatTile
        delta={{ value: -1.4, unit: "pp", label: "vs last quarter" }}
        label="Board settled"
        value={`${Math.round((settled / QUESTS.length) * 100)}%`}
      />
    </div>
  );
}
