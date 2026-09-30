import { StatDelta, StatLabel, StatRoot, StatValue } from "@kanzo-tech/ui";
import { boardValue, overdueQuests, QUESTS } from "@/example/quests";
import { availableNow } from "@/example/roster";

const settled = QUESTS.filter((contract) => contract.status === "settled").length;

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* Up is good here: more members ready is more members ready. */}
      <StatRoot>
        <StatLabel>Members ready</StatLabel>
        <StatValue>{availableNow().length}</StatValue>
        <StatDelta value={2}>vs last week</StatDelta>
      </StatRoot>
      {/* And here it is not — same green/red vocabulary, opposite meaning. */}
      <StatRoot>
        <StatLabel>Contracts overdue</StatLabel>
        <StatValue>{overdueQuests().length}</StatValue>
        <StatDelta goodWhenUp={false} value={1}>
          vs last week
        </StatDelta>
      </StatRoot>
      <StatRoot>
        <StatLabel>Unclaimed on the board</StatLabel>
        <StatValue>{boardValue("open").toLocaleString("en-US")} gold</StatValue>
        <StatDelta goodWhenUp={false} unit=" gold" value={-140}>
          vs last week
        </StatDelta>
      </StatRoot>
      <StatRoot>
        <StatLabel>Board settled</StatLabel>
        <StatValue>{Math.round((settled / QUESTS.length) * 100)}%</StatValue>
        <StatDelta unit="pp" value={-1.4}>
          vs last quarter
        </StatDelta>
      </StatRoot>
    </div>
  );
}
