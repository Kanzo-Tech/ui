import { CloudIcon } from "lucide-react";
import {
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <MetricCard href="#cloud-accounts" status="success">
      <MetricCardHeader>
        <MetricCardIcon>
          <CloudIcon />
        </MetricCardIcon>
        <MetricCardLabel>Cloud Accounts</MetricCardLabel>
      </MetricCardHeader>
      <MetricCardValue>3</MetricCardValue>
      <MetricCardDescription>accounts configured</MetricCardDescription>
    </MetricCard>
  );
}
