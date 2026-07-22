import { PlusIcon, SearchIcon } from "lucide-react";
import { Button, EmptyState } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <EmptyState
      action={
        <Button size="sm">
          <PlusIcon />
          New dataset
        </Button>
      }
      description="Nothing matched “orders-2019”. Try a broader term."
      headingLevel={2}
      icon={<SearchIcon />}
      title="No results"
    />
  );
}
