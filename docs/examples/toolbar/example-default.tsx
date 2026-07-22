import { ArrowLeftIcon, PlayIcon } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  Toolbar,
  ToolbarCenter,
  ToolbarEnd,
  ToolbarStart,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <Toolbar>
        <ToolbarStart>
          <Button aria-label="Back" size="icon-xs" variant="ghost">
            <ArrowLeftIcon />
          </Button>
          <Breadcrumbs
            className="text-[length:var(--kanzo-font-size-small)]"
            items={[
              { label: "Kanzo", href: "#" },
              { label: "mappings", href: "#" },
              { label: "aemet.fossil" },
            ]}
          />
        </ToolbarStart>

        <ToolbarCenter>fossil</ToolbarCenter>

        <ToolbarEnd>
          <Button size="xs" variant="ghost">
            Format
          </Button>
          <Button size="xs">
            <PlayIcon />
            Run
          </Button>
        </ToolbarEnd>
      </Toolbar>
    </div>
  );
}
