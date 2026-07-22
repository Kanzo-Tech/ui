import { ArrowLeftIcon, PlayIcon } from "lucide-react";
import { Breadcrumbs, Button, Toolbar } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <Toolbar
        actions={
          <>
            <Button size="xs" variant="ghost">
              Format
            </Button>
            <Button size="xs">
              <PlayIcon />
              Run
            </Button>
          </>
        }
        leading={
          <Button aria-label="Back" size="icon-xs" variant="ghost">
            <ArrowLeftIcon />
          </Button>
        }
        left={
          <Breadcrumbs
            className="text-[length:var(--kanzo-font-size-small)]"
            items={[
              { label: "Kanzo", href: "#" },
              { label: "mappings", href: "#" },
              { label: "aemet.fossil" },
            ]}
          />
        }
        right={<span>fossil</span>}
      />
      <div className="h-24 bg-background" />
    </div>
  );
}
