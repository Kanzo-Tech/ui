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
      <SegmentGroupItem className="px-3 py-1.5" value="open">
        <SegmentGroupItemText className="font-medium text-sm">
          Open
        </SegmentGroupItemText>
      </SegmentGroupItem>
      <SegmentGroupItem className="px-3 py-1.5" disabled value="settled">
        <SegmentGroupItemText className="font-medium text-sm">
          Settled
        </SegmentGroupItemText>
      </SegmentGroupItem>
    </SegmentGroup>
  );
}
