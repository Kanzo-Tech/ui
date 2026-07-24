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
  );
}
