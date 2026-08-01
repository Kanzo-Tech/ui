import { REGIONS } from "@/example/world";
import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="Region"
      className="w-44 rounded-md bg-muted p-1"
      defaultValue="Thornmarch"
      orientation="vertical"
    >
      {REGIONS.map((region) => (
        <SegmentGroupItem className="px-3 py-1.5" key={region} value={region}>
          <SegmentGroupItemText className="font-medium text-sm">
            {region}
          </SegmentGroupItemText>
        </SegmentGroupItem>
      ))}
    </SegmentGroup>
  );
}
