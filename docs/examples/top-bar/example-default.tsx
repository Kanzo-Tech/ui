import { PlusIcon, SettingsIcon } from "lucide-react";
import {
  Button,
  TopBar,
  TopBarActions,
  TopBarMain,
  TopBarSubtitle,
  TopBarTitle,
  TopBarTitleGroup,
  TopBarUtility,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background">
      <TopBar>
        <TopBarUtility>
          <span className="text-muted-foreground text-xs">kanzo / production</span>
        </TopBarUtility>

        <TopBarMain>
          <TopBarTitleGroup>
            <TopBarTitle>Catalog</TopBarTitle>
            <TopBarSubtitle>12 datasets · updated 4m ago</TopBarSubtitle>
          </TopBarTitleGroup>

          <TopBarActions>
            <Button aria-label="Settings" size="icon-sm" variant="ghost">
              <SettingsIcon />
            </Button>
            <Button size="sm">
              <PlusIcon />
              New dataset
            </Button>
          </TopBarActions>
        </TopBarMain>
      </TopBar>
    </div>
  );
}
