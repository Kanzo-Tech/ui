import { MapIcon, ShieldIcon } from "lucide-react";
import {
  RadioGroup,
  RadioGroupCard,
  RadioGroupIndicator,
  RadioGroupText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup className="w-[28rem]" columns={2} defaultValue="warden">
      <RadioGroupCard className="items-start" value="warden">
        <ShieldIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <RadioGroupText>Warden</RadioGroupText>
          <span className="text-muted-foreground text-xs leading-snug">
            Holds the line and signs for the party.
          </span>
        </div>
        <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
      </RadioGroupCard>

      <RadioGroupCard className="items-start" value="scout">
        <MapIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <RadioGroupText>Scout</RadioGroupText>
          <span className="text-muted-foreground text-xs leading-snug">
            Walks it first, alone, and comes back.
          </span>
        </div>
        <RadioGroupIndicator className="order-last mt-0.5 ms-auto" />
      </RadioGroupCard>
    </RadioGroup>
  );
}
