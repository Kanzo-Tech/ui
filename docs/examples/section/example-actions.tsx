import { PlusIcon, ScrollTextIcon } from "lucide-react";
import {
  Button,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionIcon,
  SectionTitle,
  SectionTitleGroup,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader className="w-full">
      <SectionIcon>
        <ScrollTextIcon />
      </SectionIcon>
      <SectionTitleGroup>
        <SectionTitle>Open contracts</SectionTitle>
        <SectionDescription>
          Posted to the board. Anyone chartered may claim them.
        </SectionDescription>
      </SectionTitleGroup>
      <SectionActions>
        <Button size="sm" variant="outline">
          View the whole board
        </Button>
        <Button size="sm">
          <PlusIcon />
          Post a contract
        </Button>
      </SectionActions>
    </SectionHeader>
  );
}
