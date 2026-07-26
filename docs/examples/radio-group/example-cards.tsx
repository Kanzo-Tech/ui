import { BotIcon, CodeIcon, WandIcon } from "lucide-react";
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
      defaultValue="openai"
    >
      <RadioGroupCard value="openai">
        <BotIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>OpenAI</RadioGroupText>
      </RadioGroupCard>

      <RadioGroupCard value="anthropic">
        <WandIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>Anthropic</RadioGroupText>
        <Badge size="xs" variant="outline">
          Recommended
        </Badge>
      </RadioGroupCard>

      <RadioGroupCard value="mistral">
        <CodeIcon className="size-5 shrink-0 text-muted-foreground" />
        <RadioGroupText>Mistral</RadioGroupText>
      </RadioGroupCard>
    </RadioGroup>
  );
}
