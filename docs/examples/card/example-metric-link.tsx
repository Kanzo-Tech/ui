import { UsersIcon } from "lucide-react";
import {
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from "@/showcases/metric-card/metric-card";
import { availableNow } from "@/example/roster";

export default function Example() {
  return (
    <MetricCard href="#the-roster" status="success">
      <MetricCardHeader>
        <MetricCardIcon>
          <UsersIcon />
        </MetricCardIcon>
        <MetricCardLabel>Members ready</MetricCardLabel>
      </MetricCardHeader>
      <MetricCardValue>{availableNow().length}</MetricCardValue>
      <MetricCardDescription>who can be sent today</MetricCardDescription>
    </MetricCard>
  );
}
