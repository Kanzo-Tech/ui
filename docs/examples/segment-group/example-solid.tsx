import { SegmentGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SegmentGroup
      aria-label="View mode"
      className="w-fit"
      defaultValue="list"
      options={[
        { value: "list", label: "List" },
        { value: "grid", label: "Grid" },
        { value: "graph", label: "Graph" },
      ]}
      variant="solid"
    />
  );
}
