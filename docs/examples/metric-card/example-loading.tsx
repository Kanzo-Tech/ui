import { DatabaseIcon } from "lucide-react";
import {
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from "@/showcases/metric-card/metric-card";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {/* The label and icon are known before the figure is, so only the parts that are
          actually pending swap for a skeleton. */}
      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <DatabaseIcon />
          </MetricCardIcon>
          <MetricCardLabel>Connections</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue loading>4</MetricCardValue>
        <MetricCardDescription loading>connections configured</MetricCardDescription>
      </MetricCard>

      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <DatabaseIcon />
          </MetricCardIcon>
          <MetricCardLabel>Connections</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>4</MetricCardValue>
        <MetricCardDescription>connections configured</MetricCardDescription>
      </MetricCard>
    </div>
  );
}
