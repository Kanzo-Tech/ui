import { InboxIcon } from "lucide-react";
import { EmptyState } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <EmptyState
      description="Connect a source to start ingesting records."
      icon={<InboxIcon />}
      title="No datasets yet"
    />
  );
}
