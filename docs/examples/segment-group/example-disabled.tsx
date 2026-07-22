import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="View mode"
      className="w-fit rounded-md bg-muted p-1"
      defaultValue="list"
    >
      <SegmentGroupItem className="px-3 py-1.5" value="list">
        <SegmentGroupItemText className="font-medium text-sm">
          List
        </SegmentGroupItemText>
      </SegmentGroupItem>
      <SegmentGroupItem className="px-3 py-1.5" disabled value="graph">
        <SegmentGroupItemText className="font-medium text-sm">
          Graph
        </SegmentGroupItemText>
      </SegmentGroupItem>
    </SegmentGroup>
  );
}
