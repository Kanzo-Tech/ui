"use client";

import { useState } from "react";
import { FindingsBadge, type Finding } from "@/showcases/shared";
import { daysOverdue, overdueQuests, questLabel } from "@/example/quests";

// Read off the board rather than typed out here: the tally and the list underneath it are the same
// query, which is the whole claim the badge makes.
const FINDINGS: Finding[] = overdueQuests().map((quest) => ({
  where: questLabel(quest),
  message: `${daysOverdue(quest)} days past due`,
}));

export default function Example() {
  const [marking, setMarking] = useState(false);

  return (
    <FindingsBadge
      active={marking}
      findings={FINDINGS}
      label="overdue"
      onToggle={() => setMarking((was) => !was)}
      summary="Postings the board has not closed by their own date."
      tone="warning"
    />
  );
}
