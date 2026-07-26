import {
  Badge,
  RadioGroup,
  RadioGroupCard,
  RadioGroupText,
} from "@kanzo-tech/ui";

const cards = "text-center *:flex-col *:items-center *:justify-center";

export default function Example() {
  return (
    <div className="flex w-96 flex-col gap-6">
      <RadioGroup className={cards} columns="auto" defaultValue="openai">
        <RadioGroupCard value="openai">
          <RadioGroupText>OpenAI</RadioGroupText>
        </RadioGroupCard>
        <RadioGroupCard disabled value="mistral">
          <RadioGroupText>Mistral</RadioGroupText>
          {/* A badge is free of any coupling to `disabled` — it marks a recommended
              option just as easily as an unavailable one. */}
          <Badge size="xs" variant="outline">
            Not configured
          </Badge>
        </RadioGroupCard>
      </RadioGroup>

      <RadioGroup className={cards} columns="auto" defaultValue="openai" invalid>
        <RadioGroupCard value="openai">
          <RadioGroupText>OpenAI</RadioGroupText>
        </RadioGroupCard>
        <RadioGroupCard value="anthropic">
          <RadioGroupText>Anthropic</RadioGroupText>
        </RadioGroupCard>
      </RadioGroup>
    </div>
  );
}
