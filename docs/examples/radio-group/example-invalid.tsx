import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup invalid>
      <RadioGroupItem value="warden">Warden</RadioGroupItem>
      <RadioGroupItem value="cantor">Cantor</RadioGroupItem>
    </RadioGroup>
  );
}
