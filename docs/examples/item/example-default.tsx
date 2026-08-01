import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@kanzo-tech/ui";
import { ScrollTextIcon } from "lucide-react";
import { dueOn, quest } from "@/example/quests";

const contract = quest("Q-1041");

export default function Example() {
  return (
    <Item className="w-96" variant="outline">
      <ItemMedia>
        <ScrollTextIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{contract.title}</ItemTitle>
        <ItemDescription>
          {contract.reward} gold · due {dueOn(contract)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Claim
        </Button>
      </ItemActions>
    </Item>
  );
}
