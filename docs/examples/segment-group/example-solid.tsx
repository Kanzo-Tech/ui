import { BOARD_FILTERS } from "@/example/nav";
import { SegmentGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="Contract state"
      className="w-fit"
      defaultValue="open"
      options={BOARD_FILTERS.status}
      variant="solid"
    />
  );
}
