import { Button, ButtonGroup } from "@kanzo-tech/ui";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

export default function Example() {
  return (
    <ButtonGroup aria-label="Board order" orientation="vertical">
      <Button aria-label="Raise this contract" size="icon-md" variant="outline">
        <ChevronUpIcon />
      </Button>
      <Button aria-label="Lower this contract" size="icon-md" variant="outline">
        <ChevronDownIcon />
      </Button>
    </ButtonGroup>
  );
}
