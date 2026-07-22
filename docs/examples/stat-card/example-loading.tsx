import { DatabaseIcon } from "lucide-react";
import {
  StatCard,
  StatCardDescription,
  StatCardHeader,
  StatCardIcon,
  StatCardLabel,
  StatCardValue,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* The label and icon are known before the figure is, so only the parts that are
          actually pending swap for a skeleton. */}
      <StatCard>
        <StatCardHeader>
          <StatCardIcon>
            <DatabaseIcon />
          </StatCardIcon>
          <StatCardLabel>Connections</StatCardLabel>
        </StatCardHeader>
        <StatCardValue loading>4</StatCardValue>
        <StatCardDescription loading>connections configured</StatCardDescription>
      </StatCard>

      <StatCard>
        <StatCardHeader>
          <StatCardIcon>
            <DatabaseIcon />
          </StatCardIcon>
          <StatCardLabel>Connections</StatCardLabel>
        </StatCardHeader>
        <StatCardValue>4</StatCardValue>
        <StatCardDescription>connections configured</StatCardDescription>
      </StatCard>
    </div>
  );
}
