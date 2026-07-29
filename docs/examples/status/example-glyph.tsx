import { Status } from "@kanzo-tech/ui";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

const states = [
  { glyph: <MinusIcon />, label: "Unknown", variant: "default" },
  { glyph: <CheckIcon />, label: "Passed", variant: "success" },
  { glyph: <XIcon />, label: "Failed", variant: "destructive" },
] as const;

export default function Example() {
  return (
    <div className="flex flex-col gap-2">
      {states.map((state) => (
        <span
          className="inline-flex items-center gap-2 text-sm"
          key={state.variant}
        >
          <Status size="lg" variant={state.variant}>
            {state.glyph}
          </Status>
          {state.label}
        </span>
      ))}
    </div>
  );
}
