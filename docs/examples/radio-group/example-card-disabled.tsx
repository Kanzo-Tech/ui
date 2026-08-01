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
      <RadioGroup className={cards} columns="auto" defaultValue="amber">
        <RadioGroupCard value="amber">
          <RadioGroupText>Amber Hall</RadioGroupText>
        </RadioGroupCard>
        <RadioGroupCard disabled value="lanternwood">
          <RadioGroupText>Lanternwood</RadioGroupText>
          {/* A badge is free of any coupling to `disabled` — it marks a recommended
              option just as easily as an unavailable one. */}
          <Badge size="xs" variant="outline">
            Invited
          </Badge>
        </RadioGroupCard>
      </RadioGroup>

      <RadioGroup className={cards} columns="auto" defaultValue="amber" invalid>
        <RadioGroupCard value="amber">
          <RadioGroupText>Amber Hall</RadioGroupText>
        </RadioGroupCard>
        <RadioGroupCard value="salt">
          <RadioGroupText>Salt</RadioGroupText>
        </RadioGroupCard>
      </RadioGroup>
    </div>
  );
}
