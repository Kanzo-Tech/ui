import { CloudIcon } from "lucide-react";
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
    <StatCard href="#cloud-accounts" status="success">
      <StatCardHeader>
        <StatCardIcon>
          <CloudIcon />
        </StatCardIcon>
        <StatCardLabel>Cloud Accounts</StatCardLabel>
      </StatCardHeader>
      <StatCardValue>3</StatCardValue>
      <StatCardDescription>accounts configured</StatCardDescription>
    </StatCard>
  );
}
