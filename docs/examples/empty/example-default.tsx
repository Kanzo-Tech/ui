import { ClockIcon } from "lucide-react";
import {
  Button,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  EmptyTitle,
} from "@kanzo-tech/ui";
import { isOverdue, questsOf } from "@/example/quests";
import { hall } from "@/example/world";

const amber = hall("amber");
const overdue = questsOf("amber").filter(isOverdue);

export default function Example() {
  return (
    <EmptyRoot>
      <EmptyHeader>
        <EmptyIndicator variant="icon">
          <ClockIcon />
        </EmptyIndicator>
        <EmptyTitle asChild>
          <h3>Nothing overdue</h3>
        </EmptyTitle>
        <EmptyDescription>
          {overdue.length} of the {questsOf("amber").length} contracts {amber.short} has posted are
          past their date. Anything afield and late shows up here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Open the board</Button>
      </EmptyContent>
    </EmptyRoot>
  );
}
