import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>
        <PlusIcon />
        New dataset
      </Button>
      <Button variant="outline">
        <SearchIcon />
        Search
      </Button>
      <Button aria-label="Add" size="icon-md" variant="outline">
        <PlusIcon />
      </Button>
    </div>
  );
}
