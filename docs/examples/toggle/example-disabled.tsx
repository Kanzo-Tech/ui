import { MoonIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Night work" disabled>
        <MoonIcon />
      </Toggle>
      <Toggle aria-label="Night work" defaultPressed disabled variant="outline">
        <MoonIcon />
      </Toggle>
    </div>
  );
}
