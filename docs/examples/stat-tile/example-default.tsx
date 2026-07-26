"use client";

import { StatTile } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatTile label="Rows ingested" trend={[8, 9, 11, 10, 13, 14, 13, 16]} value={12_400_000} />
      <StatTile
        delta={{ value: 4.2, unit: "%", label: "vs last week" }}
        label="Pipeline runs"
        value={1284}
      />
    </div>
  );
}
