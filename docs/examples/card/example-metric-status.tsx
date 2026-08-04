import { FootprintsIcon, ScrollTextIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import {
  MetricCard,
  MetricCardDescription,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from "@/showcases/metric-card/metric-card";
import { overdueQuests, QUESTS } from "@/example/quests";
import { availableNow } from "@/example/roster";

const afield = QUESTS.filter((contract) => contract.status === "afield").length;

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <MetricCard>
        <MetricCardHeader>
          <MetricCardIcon>
            <ScrollTextIcon />
          </MetricCardIcon>
          <MetricCardLabel>On the board</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>{QUESTS.length}</MetricCardValue>
        <MetricCardDescription>contracts, all halls</MetricCardDescription>
      </MetricCard>

      <MetricCard status="success">
        <MetricCardHeader>
          <MetricCardIcon>
            <UsersIcon />
          </MetricCardIcon>
          <MetricCardLabel>Members ready</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>{availableNow().length}</MetricCardValue>
        <MetricCardDescription>who can be sent today</MetricCardDescription>
      </MetricCard>

      <MetricCard status="warning">
        <MetricCardHeader>
          <MetricCardIcon>
            <FootprintsIcon />
          </MetricCardIcon>
          <MetricCardLabel>Parties afield</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>{afield}</MetricCardValue>
        <MetricCardDescription>out, no word expected</MetricCardDescription>
      </MetricCard>

      <MetricCard status="danger">
        <MetricCardHeader>
          <MetricCardIcon>
            <TriangleAlertIcon />
          </MetricCardIcon>
          <MetricCardLabel>Overdue</MetricCardLabel>
        </MetricCardHeader>
        <MetricCardValue>{overdueQuests().length}</MetricCardValue>
        <MetricCardDescription>past the due date</MetricCardDescription>
      </MetricCard>
    </div>
  );
}
