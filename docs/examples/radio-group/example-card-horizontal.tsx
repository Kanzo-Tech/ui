import { CodeIcon, WandIcon } from "lucide-react";
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup className="w-[28rem]" columns={2} defaultValue="studio">
      <RadioGroupCard className="items-start" value="studio">
        <CodeIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <RadioGroupText>Studio</RadioGroupText>
          <span className="text-muted-foreground text-xs leading-snug">
            Write the mapping yourself, in the editor.
          </span>
        </div>
        <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
      </RadioGroupCard>

      <RadioGroupCard className="items-start" value="assistant">
        <WandIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <RadioGroupText>Assistant</RadioGroupText>
          <span className="text-muted-foreground text-xs leading-snug">
            Describe the result and let the assistant draft it.
          </span>
        </div>
        <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
      </RadioGroupCard>
    </RadioGroup>
  );
}
