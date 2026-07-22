import { DatabaseIcon, PlusIcon } from "lucide-react";
import {
  Button,
  SectionHeader,
  SectionHeaderActions,
  SectionHeaderContent,
  SectionHeaderDescription,
  SectionHeaderIcon,
  SectionHeaderTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader className="w-full">
      <SectionHeaderIcon>
        <DatabaseIcon />
      </SectionHeaderIcon>
      <SectionHeaderContent>
        <SectionHeaderTitle>Connections</SectionHeaderTitle>
        <SectionHeaderDescription>
          Sources this workspace reads from.
        </SectionHeaderDescription>
      </SectionHeaderContent>
      <SectionHeaderActions>
        <Button size="sm" variant="outline">
          View all
        </Button>
        <Button size="sm">
          <PlusIcon />
          New connection
        </Button>
      </SectionHeaderActions>
    </SectionHeader>
  );
}
