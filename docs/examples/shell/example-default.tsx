import { ArrowLeftIcon, PlayIcon } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  ShellHeader,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      {/* The IDE density is the CALLER's — the region imposes no height, surface or
          typography. See DESIGN.md, "The layout layer". */}
      <ShellHeader className="h-8 flex-row items-center gap-2 bg-card px-2 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
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
        </div>

        <div className="shrink-0">fossil</div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="xs" variant="ghost">
            Format
          </Button>
          <Button size="xs">
            <PlayIcon />
            Run
          </Button>
        </div>
      </ShellHeader>
    </div>
  );
}
