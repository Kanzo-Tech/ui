import { ScrollTextIcon } from "lucide-react";
import { StatDescription, StatIndicator, StatLabel, StatRoot, StatValue } from "@kanzo-tech/ui";
import { openQuests } from "@/example/quests";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* The label, the icon and the description are known before the figure is, so only the
          figure swaps for a skeleton. */}
      <StatRoot>
        <StatIndicator>
          <ScrollTextIcon />
        </StatIndicator>
        <StatLabel>Open contracts</StatLabel>
        <StatValue loading>{openQuests().length}</StatValue>
        <StatDescription>waiting for a party</StatDescription>
      </StatRoot>
      <StatRoot>
        <StatIndicator>
          <ScrollTextIcon />
        </StatIndicator>
        <StatLabel>Open contracts</StatLabel>
        <StatValue>{openQuests().length}</StatValue>
        <StatDescription>waiting for a party</StatDescription>
      </StatRoot>
    </div>
  );
}
