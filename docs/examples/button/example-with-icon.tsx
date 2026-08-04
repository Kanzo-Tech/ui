import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>
        <PlusIcon />
        Post a contract
      </Button>
      <Button variant="outline">
        <SearchIcon />
        Find a member
      </Button>
      <Button aria-label="Post a contract" size="icon-md" variant="outline">
        <PlusIcon />
      </Button>
    </div>
  );
}
