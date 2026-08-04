import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  NumberInputLabel,
  NumberInputScrubber,
} from "@kanzo-tech/ui";
import { MoveHorizontalIcon } from "lucide-react";

export default function Example() {
  return (
    <NumberInput className="w-44" defaultValue="14" max={90} min={0}>
      {/* Drag the label left/right to scrub the value — the pointer capture, delta and clamping
          all come from Ark's machine. */}
      <NumberInputScrubber>
        <NumberInputLabel className="flex items-center gap-1.5">
          <MoveHorizontalIcon className="size-3.5 text-muted-foreground" />
          Days to deliver
        </NumberInputLabel>
      </NumberInputScrubber>
      <NumberInputControl>
        <NumberInputInput />
        <NumberInputIncrementTrigger />
        <NumberInputDecrementTrigger />
      </NumberInputControl>
    </NumberInput>
  );
}
