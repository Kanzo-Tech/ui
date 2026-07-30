"use client";

import { StatTile } from "@kanzo-tech/ui";
import { boardValue, QUESTS } from "@/example/quests";

// Contracts posted in each of the last eight months, off the board's own clock.
const byMonth = Array.from({ length: 8 }, (_, index) => {
  const from = -30 * (8 - index);
  return QUESTS.filter(
    (contract) => contract.postedDayOffset >= from && contract.postedDayOffset < from + 30,
  ).length;
});

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatTile label="Contracts posted" trend={byMonth} value={QUESTS.length} />
      <StatTile
        delta={{ value: byMonth[7] - byMonth[6], label: "vs last month" }}
        label="Gold on the board"
        value={boardValue()}
      />
    </div>
  );
}
