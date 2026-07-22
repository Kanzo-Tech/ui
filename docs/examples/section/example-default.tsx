import { PlusIcon } from "lucide-react";
import {
  Button,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionFooter,
  SectionHeader,
  SectionRoot,
  SectionTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    // Only `SectionBody` scrolls, and it can only do that if the shell resolves to a
    // real height — so the wrapper fixes one instead of letting the flex parent grow.
    <div className="flex h-[380px] w-full overflow-hidden rounded-lg border bg-background">
      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitle level={1} scale="page">Dashboard</SectionTitle>
          <SectionDescription>
            Everything this workspace publishes, at a glance.
          </SectionDescription>
          <SectionActions>
            <Button size="sm">
              <PlusIcon />
              New connection
            </Button>
          </SectionActions>
        </SectionHeader>

        <SectionBody scale="page">
          <div className="h-64 rounded-lg border border-border border-dashed" />
        </SectionBody>

        <SectionFooter>
          <span className="text-muted-foreground text-sm">12 connections</span>
          <Button size="sm" variant="outline">
            Export
          </Button>
        </SectionFooter>
      </SectionRoot>
    </div>
  );
}
