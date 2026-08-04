import { ClockIcon } from "lucide-react";
import { Toggle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Past its due date">
        <ClockIcon />
      </Toggle>
      <Toggle aria-label="Past its due date" variant="outline">
        <ClockIcon />
      </Toggle>
    </div>
  );
}
