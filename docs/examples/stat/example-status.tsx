import { FootprintsIcon, ScrollTextIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { StatDescription, StatIndicator, StatLabel, StatRoot, StatValue } from "@kanzo-tech/ui";
import { overdueQuests, QUESTS } from "@/example/quests";
import { availableNow } from "@/example/roster";

const afield = QUESTS.filter((contract) => contract.status === "afield").length;

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatRoot>
        <StatIndicator>
          <ScrollTextIcon />
        </StatIndicator>
        <StatLabel>On the board</StatLabel>
        <StatValue>{QUESTS.length}</StatValue>
        <StatDescription>contracts, all halls</StatDescription>
      </StatRoot>
      <StatRoot variant="success">
        <StatIndicator>
          <UsersIcon />
        </StatIndicator>
        <StatLabel>Members ready</StatLabel>
        <StatValue>{availableNow().length}</StatValue>
        <StatDescription>who can be sent today</StatDescription>
      </StatRoot>
      <StatRoot variant="warning">
        <StatIndicator>
          <FootprintsIcon />
        </StatIndicator>
        <StatLabel>Parties afield</StatLabel>
        <StatValue>{afield}</StatValue>
        <StatDescription>out, no word expected</StatDescription>
      </StatRoot>
      <StatRoot variant="destructive">
        <StatIndicator>
          <TriangleAlertIcon />
        </StatIndicator>
        <StatLabel>Overdue</StatLabel>
        <StatValue>{overdueQuests().length}</StatValue>
        <StatDescription>past the due date</StatDescription>
      </StatRoot>
    </div>
  );
}
