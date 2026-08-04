import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup defaultValue="warden">
      <RadioGroupItem value="warden">Warden</RadioGroupItem>
      <RadioGroupItem value="scout">Scout</RadioGroupItem>
      <RadioGroupItem value="cantor">Cantor</RadioGroupItem>
    </RadioGroup>
  );
}
