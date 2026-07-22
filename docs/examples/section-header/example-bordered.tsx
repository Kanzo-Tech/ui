import { Button, SectionHeader } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader
      actions={
        <Button size="sm" variant="outline">
          Edit
        </Button>
      }
      bordered
      className="w-full"
      description="Applies to every job in this workspace."
      headingLevel={3}
      title="Job defaults"
    />
  );
}
