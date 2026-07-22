import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="Section"
      className="w-fit"
      defaultValue="overview"
      variant="underline"
    >
      {["Overview", "Schema", "Runs"].map((label) => (
        <SegmentGroupItem
          className="px-3 py-2"
          key={label}
          value={label.toLowerCase()}
        >
          <SegmentGroupItemText className="font-medium text-sm">
            {label}
          </SegmentGroupItemText>
        </SegmentGroupItem>
      ))}
    </SegmentGroup>
  );
}
