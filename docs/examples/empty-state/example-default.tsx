import { ScrollTextIcon } from "lucide-react";
import { EmptyState } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <EmptyState
      description="Post one and any chartered hall may claim it."
      icon={<ScrollTextIcon />}
      title="Nothing on the board"
    />
  );
}
