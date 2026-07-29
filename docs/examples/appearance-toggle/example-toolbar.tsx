import { AppearanceToggle, Button, ButtonGroup, ButtonGroupSeparator } from "@kanzo-tech/ui";
import { BellIcon, SearchIcon } from "lucide-react";

export default function Example() {
  return (
    <ButtonGroup aria-label="Application bar">
      <Button aria-label="Search" size="icon-md" variant="outline">
        <SearchIcon />
      </Button>
      <Button aria-label="Notifications" size="icon-md" variant="outline">
        <BellIcon />
      </Button>
      <ButtonGroupSeparator />
      <AppearanceToggle size="icon-md" variant="outline" />
    </ButtonGroup>
  );
}
