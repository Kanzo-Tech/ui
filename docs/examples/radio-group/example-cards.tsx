import { AnchorIcon, FlameIcon, ShieldIcon } from "lucide-react";
import {
  Badge,
  RadioGroup,
  RadioGroupCard,
  RadioGroupText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup
      // One class list on the group instead of the same one repeated per card: the cards are
      // its direct children, so `*:` reaches them and `text-center` simply inherits.
      className="w-96 text-center *:flex-col *:items-center *:justify-center"
      columns="auto"
      defaultValue="amber"
    >
      <RadioGroupCard value="amber">
        <ShieldIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>Amber Hall</RadioGroupText>
        <Badge size="xs" variant="outline">
          Chartered
        </Badge>
      </RadioGroupCard>

      <RadioGroupCard value="salt">
        <AnchorIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>Salt</RadioGroupText>
      </RadioGroupCard>

      <RadioGroupCard value="ash">
        <FlameIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>Ash Co.</RadioGroupText>
      </RadioGroupCard>
    </RadioGroup>
  );
}
