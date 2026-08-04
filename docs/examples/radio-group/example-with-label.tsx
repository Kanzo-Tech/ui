import { RadioGroup, RadioGroupItem, RadioGroupLabel } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup defaultValue="silver">
      <RadioGroupLabel>Minimum rank</RadioGroupLabel>
      <RadioGroupItem value="copper">Copper</RadioGroupItem>
      <RadioGroupItem value="iron">Iron</RadioGroupItem>
      <RadioGroupItem value="silver">Silver</RadioGroupItem>
    </RadioGroup>
  );
}
