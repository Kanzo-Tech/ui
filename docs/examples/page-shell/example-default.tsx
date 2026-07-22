import { PlusIcon } from "lucide-react";
import { Button, PageShell } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex h-[380px] w-full overflow-hidden rounded-lg border bg-background">
      <PageShell>
        <PageShell.Header
          actions={
            <Button size="sm">
              <PlusIcon />
              New connection
            </Button>
          }
          description="Everything this workspace publishes, at a glance."
          title="Dashboard"
        />
        <PageShell.Content>
          <div className="h-64 rounded-lg border border-border border-dashed" />
        </PageShell.Content>
        <PageShell.Footer>
          <span className="text-muted-foreground text-sm">12 connections</span>
          <Button size="sm" variant="outline">
            Export
          </Button>
        </PageShell.Footer>
      </PageShell>
    </div>
  );
}
