import { BoldIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Bold" disabled>
        <BoldIcon />
      </Toggle>
      <Toggle aria-label="Bold" defaultPressed disabled variant="outline">
        <BoldIcon />
      </Toggle>
    </div>
  );
}
