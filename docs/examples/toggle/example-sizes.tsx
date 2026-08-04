import { PawPrintIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Has a beast" size="sm" variant="outline">
        <PawPrintIcon />
      </Toggle>
      <Toggle aria-label="Has a beast" size="md" variant="outline">
        <PawPrintIcon />
      </Toggle>
      <Toggle aria-label="Has a beast" size="lg" variant="outline">
        <PawPrintIcon />
      </Toggle>
    </div>
  );
}
