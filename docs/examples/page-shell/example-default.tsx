import { PlusIcon } from "lucide-react";
import {
  Button,
  PageShell,
  PageShellActions,
  PageShellContent,
  PageShellDescription,
  PageShellFooter,
  PageShellHeader,
  PageShellTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    // Only `PageShellContent` scrolls, and it can only do that if the shell resolves to a
    // real height — so the wrapper fixes one instead of letting the flex parent grow.
    <div className="flex h-[380px] w-full overflow-hidden rounded-lg border bg-background">
      <PageShell>
        <PageShellHeader>
          <PageShellTitle>Dashboard</PageShellTitle>
          <PageShellDescription>
            Everything this workspace publishes, at a glance.
          </PageShellDescription>
          <PageShellActions>
            <Button size="sm">
              <PlusIcon />
              New connection
            </Button>
          </PageShellActions>
        </PageShellHeader>

        <PageShellContent>
          <div className="h-64 rounded-lg border border-border border-dashed" />
        </PageShellContent>

        <PageShellFooter>
          <span className="text-muted-foreground text-sm">12 connections</span>
          <Button size="sm" variant="outline">
            Export
          </Button>
        </PageShellFooter>
      </PageShell>
    </div>
  );
}
