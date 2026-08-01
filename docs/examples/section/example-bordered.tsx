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
        <SectionTitle level={3}>Party rules</SectionTitle>
        <SectionDescription>
          Checked when a party signs, and again when it comes back.
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
