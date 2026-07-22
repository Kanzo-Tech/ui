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
  );
}
