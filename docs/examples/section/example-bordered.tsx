import {
  Button,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionTitle,
  SectionTitleGroup,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader bordered className="w-full">
      <SectionTitleGroup>
        <SectionTitle level={3}>Job defaults</SectionTitle>
        <SectionDescription>
          Applies to every job in this workspace.
        </SectionDescription>
      </SectionTitleGroup>
      <SectionActions>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </SectionActions>
    </SectionHeader>
  );
}
