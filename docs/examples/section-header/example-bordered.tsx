import {
  Button,
  SectionHeader,
  SectionHeaderActions,
  SectionHeaderContent,
  SectionHeaderDescription,
  SectionHeaderTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader bordered className="w-full">
      <SectionHeaderContent>
        <SectionHeaderTitle level={3}>Job defaults</SectionHeaderTitle>
        <SectionHeaderDescription>
          Applies to every job in this workspace.
        </SectionHeaderDescription>
      </SectionHeaderContent>
      <SectionHeaderActions>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </SectionHeaderActions>
    </SectionHeader>
  );
}
