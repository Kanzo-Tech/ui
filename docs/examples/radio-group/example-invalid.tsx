import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup invalid>
      <RadioGroupItem value="ttl">Turtle</RadioGroupItem>
      <RadioGroupItem value="jsonld">JSON-LD</RadioGroupItem>
    </RadioGroup>
  );
}
