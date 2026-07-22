import { DatabaseIcon, PlusIcon } from "lucide-react";
import { Button, SectionHeader } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <SectionHeader
      actions={
        <>
          <Button size="sm" variant="outline">
            View all
          </Button>
          <Button size="sm">
            <PlusIcon />
            New connection
          </Button>
        </>
      }
      className="w-full"
      description="Sources this workspace reads from."
      icon={<DatabaseIcon />}
      title="Connections"
    />
  );
}
