import { ArrowLeftIcon, PlayIcon } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  ShellBar,
  ShellBarCenter,
  ShellBarEnd,
  ShellBarStart,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <ShellBar>
        <ShellBarStart>
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
        </ShellBarStart>

        <ShellBarCenter>fossil</ShellBarCenter>

        <ShellBarEnd>
          <Button size="xs" variant="ghost">
            Format
          </Button>
          <Button size="xs">
            <PlayIcon />
            Run
          </Button>
        </ShellBarEnd>
      </ShellBar>
    </div>
  );
}
