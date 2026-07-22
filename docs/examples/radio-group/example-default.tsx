import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup defaultValue="ttl">
      <RadioGroupItem value="ttl">Turtle</RadioGroupItem>
      <RadioGroupItem value="jsonld">JSON-LD</RadioGroupItem>
      <RadioGroupItem value="nt">N-Triples</RadioGroupItem>
    </RadioGroup>
  );
}
