import { HALLS } from "@/example/world";
import { RadioGroup, RadioGroupCard, RadioGroupText } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup
      className="w-96 text-center *:flex-col *:items-center *:justify-center"
      columns={3}
      defaultValue="amber"
    >
      {HALLS.map((entry) => (
        <RadioGroupCard key={entry.id} value={entry.id}>
          <span
            className="size-6 rounded-full"
            style={{ background: entry.heraldry.brand }}
          />
          <RadioGroupText>{entry.short}</RadioGroupText>
        </RadioGroupCard>
      ))}
    </RadioGroup>
  );
}
