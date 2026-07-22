import { UnderlineIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Underline" size="sm" variant="outline">
        <UnderlineIcon />
      </Toggle>
      <Toggle aria-label="Underline" size="md" variant="outline">
        <UnderlineIcon />
      </Toggle>
      <Toggle aria-label="Underline" size="lg" variant="outline">
        <UnderlineIcon />
      </Toggle>
    </div>
  );
}
