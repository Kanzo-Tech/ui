import {
  SectionHeader,
  SectionHeaderContent,
  SectionHeaderDescription,
  SectionHeaderTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader className="w-full">
      <SectionHeaderContent>
        <SectionHeaderTitle>Connections</SectionHeaderTitle>
        <SectionHeaderDescription>
          Sources this workspace reads from.
        </SectionHeaderDescription>
      </SectionHeaderContent>
    </SectionHeader>
  );
}
