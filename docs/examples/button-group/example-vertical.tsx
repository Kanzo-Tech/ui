import { Button, ButtonGroup } from "@kanzo-tech/ui";
import { MinusIcon, PlusIcon } from "lucide-react";

export default function Example() {
  return (
    <ButtonGroup aria-label="Zoom" orientation="vertical">
      <Button aria-label="Zoom in" size="icon-md" variant="outline">
        <PlusIcon />
      </Button>
      <Button aria-label="Zoom out" size="icon-md" variant="outline">
        <MinusIcon />
      </Button>
    </ButtonGroup>
  );
}
