import { ScrollTextIcon } from "lucide-react";
import {
  FormatNumber,
  StatDelta,
  StatDescription,
  StatIndicator,
  StatLabel,
  StatRoot,
  StatTrend,
  StatValue,
} from "@kanzo-tech/ui";
import { boardValue, openQuests, postedByMonth } from "@/example/quests";

const posted = postedByMonth();

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatRoot>
        <StatIndicator>
          <ScrollTextIcon />
        </StatIndicator>
        <StatLabel>Open contracts</StatLabel>
        <StatValue>{openQuests().length}</StatValue>
        <StatTrend values={posted} />
        <StatDelta value={(posted.at(-1) ?? 0) - (posted.at(-2) ?? 0)}>vs last month</StatDelta>
      </StatRoot>
      <StatRoot>
        <StatLabel>Gold on the board</StatLabel>
        <StatValue>
          <FormatNumber value={boardValue()} /> gold
        </StatValue>
        <StatDescription>across every open contract</StatDescription>
      </StatRoot>
    </div>
  );
}
