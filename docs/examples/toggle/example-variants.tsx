import { ItalicIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Italic">
        <ItalicIcon />
      </Toggle>
      <Toggle aria-label="Italic" variant="outline">
        <ItalicIcon />
      </Toggle>
    </div>
  );
}
