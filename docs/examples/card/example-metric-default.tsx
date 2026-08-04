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
  );
}
