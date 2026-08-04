import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="Board filter"
      className="w-fit rounded-md bg-muted p-1"
      defaultValue="open"
    >
      {["Open", "Afield", "Settled"].map((label) => (
        <SegmentGroupItem
          className="px-3 py-1.5"
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
