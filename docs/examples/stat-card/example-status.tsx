import { BoxesIcon, BriefcaseIcon, CloudIcon, DatabaseIcon } from "lucide-react";
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
      <StatCard>
        <StatCardHeader>
          <StatCardIcon>
            <BoxesIcon />
          </StatCardIcon>
          <StatCardLabel>DCAT Catalogs</StatCardLabel>
        </StatCardHeader>
        <StatCardValue>7</StatCardValue>
        <StatCardDescription>catalogs generated</StatCardDescription>
      </StatCard>

      <StatCard status="success">
        <StatCardHeader>
          <StatCardIcon>
            <CloudIcon />
          </StatCardIcon>
          <StatCardLabel>Cloud Accounts</StatCardLabel>
        </StatCardHeader>
        <StatCardValue>3</StatCardValue>
        <StatCardDescription>accounts configured</StatCardDescription>
      </StatCard>

      <StatCard status="warning">
        <StatCardHeader>
          <StatCardIcon>
            <DatabaseIcon />
          </StatCardIcon>
          <StatCardLabel>Drafts</StatCardLabel>
        </StatCardHeader>
        <StatCardValue>2</StatCardValue>
        <StatCardDescription>waiting on review</StatCardDescription>
      </StatCard>

      <StatCard status="danger">
        <StatCardHeader>
          <StatCardIcon>
            <BriefcaseIcon />
          </StatCardIcon>
          <StatCardLabel>Jobs</StatCardLabel>
        </StatCardHeader>
        <StatCardValue>12</StatCardValue>
        <StatCardDescription>last run failed</StatCardDescription>
      </StatCard>
    </div>
  );
}
