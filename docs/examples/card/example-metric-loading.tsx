import { ScrollTextIcon } from "lucide-react";
import {
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from "@/showcases/metric-card/metric-card";
import { openQuests } from "@/example/quests";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* The label and icon are known before the figure is, so only the parts that are
          actually pending swap for a skeleton. */}
      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <ScrollTextIcon />
          </MetricCardIcon>
          <MetricCardLabel>Open contracts</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue loading>{openQuests().length}</MetricCardValue>
        <MetricCardDescription loading>waiting for a party</MetricCardDescription>
      </MetricCard>

      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <ScrollTextIcon />
          </MetricCardIcon>
          <MetricCardLabel>Open contracts</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>{openQuests().length}</MetricCardValue>
        <MetricCardDescription>waiting for a party</MetricCardDescription>
      </MetricCard>
    </div>
  );
}
