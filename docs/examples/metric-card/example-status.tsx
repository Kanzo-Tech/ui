import { BoxesIcon, BriefcaseIcon, CloudIcon, DatabaseIcon } from "lucide-react";
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
      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <BoxesIcon />
          </MetricCardIcon>
          <MetricCardLabel>DCAT Catalogs</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>7</MetricCardValue>
        <MetricCardDescription>catalogs generated</MetricCardDescription>
      </MetricCard>

      <MetricCard status="success">
        <MetricCardHeader>
          <MetricCardIcon>
            <CloudIcon />
          </MetricCardIcon>
          <MetricCardLabel>Cloud Accounts</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>3</MetricCardValue>
        <MetricCardDescription>accounts configured</MetricCardDescription>
      </MetricCard>

      <MetricCard status="warning">
        <MetricCardHeader>
          <MetricCardIcon>
            <DatabaseIcon />
          </MetricCardIcon>
          <MetricCardLabel>Drafts</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>2</MetricCardValue>
        <MetricCardDescription>waiting on review</MetricCardDescription>
      </MetricCard>

      <MetricCard status="danger">
        <MetricCardHeader>
          <MetricCardIcon>
            <BriefcaseIcon />
          </MetricCardIcon>
          <MetricCardLabel>Jobs</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>12</MetricCardValue>
        <MetricCardDescription>last run failed</MetricCardDescription>
      </MetricCard>
    </div>
  );
}
