"use client";

import { StatTile } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* Up is good here: more connections is more connections. */}
      <StatTile
        delta={{ value: 2, label: "vs last week" }}
        label="Active connections"
        value={24}
      />
      {/* And here it is not — same green/red vocabulary, opposite meaning. */}
      <StatTile
        delta={{ value: 3, label: "vs last week", goodWhenUp: false }}
        label="Failed runs"
        value={7}
      />
      <StatTile
        delta={{ value: -18, unit: "ms", label: "vs last week", goodWhenUp: false }}
        label="p95 latency"
        value="284 ms"
      />
      <StatTile
        delta={{ value: -1.4, unit: "pp", label: "vs last quarter" }}
        label="Coverage"
        value="98.2%"
      />
    </div>
  );
}
