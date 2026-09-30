import { MapIcon } from "lucide-react";
import {
  Button,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  EmptyTitle,
} from "@kanzo-tech/ui";
import { questsOf } from "@/example/quests";
import { hall } from "@/example/world";

const amber = hall("amber");
const region = "Duskfen";
const matches = questsOf("amber").filter((candidate) => candidate.region === region);

export default function Example() {
  return (
    // The root carries `border-dashed` already; `border` is what draws it, standing in for the
    // table the filter emptied.
    <EmptyRoot className="w-full max-w-xl border">
      <EmptyHeader>
        <EmptyIndicator className="text-muted-foreground [&_svg]:size-8">
          <MapIcon />
        </EmptyIndicator>
        <EmptyTitle asChild>
          <h3>
            {matches.length} contracts in {region}
          </h3>
        </EmptyTitle>
        <EmptyDescription>
          {amber.name} has posted nothing in {region}. Clear the region to see the whole board.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline">
          Clear the filter
        </Button>
      </EmptyContent>
    </EmptyRoot>
  );
}
