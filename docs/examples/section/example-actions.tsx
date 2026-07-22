import { DatabaseIcon, PlusIcon } from "lucide-react";
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
        <DatabaseIcon />
      </SectionIcon>
      <SectionTitleGroup>
        <SectionTitle>Connections</SectionTitle>
        <SectionDescription>
          Sources this workspace reads from.
        </SectionDescription>
      </SectionTitleGroup>
      <SectionActions>
        <Button size="sm" variant="outline">
          View all
        </Button>
        <Button size="sm">
          <PlusIcon />
          New connection
        </Button>
      </SectionActions>
    </SectionHeader>
  );
}
