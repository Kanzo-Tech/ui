import { PlusIcon, SearchIcon } from "lucide-react";
import { Button, EmptyState } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <EmptyState
      action={
        <Button size="sm">
          <PlusIcon />
          Post a contract
        </Button>
      }
      description="Nothing open in Coldiron is graded above a Hazard. Try a wider grade."
      headingLevel={2}
      icon={<SearchIcon />}
      title="No contracts match"
    />
  );
}
