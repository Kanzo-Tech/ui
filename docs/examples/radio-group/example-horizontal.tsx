import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup
      className="flex-row gap-6"
      defaultValue="warden"
      orientation="horizontal"
    >
      <RadioGroupItem value="warden">Warden</RadioGroupItem>
      <RadioGroupItem value="scout">Scout</RadioGroupItem>
      <RadioGroupItem value="cantor">Cantor</RadioGroupItem>
    </RadioGroup>
  );
}
