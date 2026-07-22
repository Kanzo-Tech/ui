import { PlusIcon } from "lucide-react";
import {
  AppShell,
  AppShellBody,
  AppShellMain,
  Button,
  SidePanel,
  TopBar,
  TopBarActions,
  TopBarMain,
  TopBarSubtitle,
  TopBarTitle,
  TopBarTitleGroup,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    // AppShell is `h-screen` by design — it owns the viewport in a real app. Here it is
    // pinned to a fixed height so the shell fits in the page, and the class wins because
    // `cn` runs tailwind-merge.
    <AppShell className="h-[420px] w-full overflow-hidden rounded-lg border bg-background">
      <TopBar>
        <TopBarMain>
          <TopBarTitleGroup>
            <TopBarTitle>Catalog</TopBarTitle>
            <TopBarSubtitle>12 datasets</TopBarSubtitle>
          </TopBarTitleGroup>
          <TopBarActions>
            <Button size="sm">
              <PlusIcon />
              New dataset
            </Button>
          </TopBarActions>
        </TopBarMain>
      </TopBar>

      <AppShellBody>
        {/* The asides are plain children, so their order is the caller's — which is what
            lets the whole layout mirror in RTL. */}
        <SidePanel side="left" width={180}>
          <nav className="flex flex-col gap-1 p-2 text-sm">
            <span className="rounded-md bg-accent px-2 py-1 font-medium">Datasets</span>
            <span className="px-2 py-1 text-muted-foreground">Distributions</span>
            <span className="px-2 py-1 text-muted-foreground">Vocabularies</span>
          </nav>
        </SidePanel>

        <AppShellMain>
          <div className="p-4">
            <div className="h-96 rounded-lg border border-border border-dashed" />
          </div>
        </AppShellMain>

        <SidePanel side="right" width={200}>
          <div className="p-3 text-muted-foreground text-xs">
            <p className="mb-1 font-medium text-foreground">Details</p>
            <p>Select a dataset to inspect it.</p>
          </div>
        </SidePanel>
      </AppShellBody>
    </AppShell>
  );
}
