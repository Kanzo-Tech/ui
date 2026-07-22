import { RadioGroup, RadioGroupItem, RadioGroupLabel } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <RadioGroup defaultValue="private">
      <RadioGroupLabel>Visibility</RadioGroupLabel>
      <RadioGroupItem value="public">Public</RadioGroupItem>
      <RadioGroupItem value="private">Private</RadioGroupItem>
      <RadioGroupItem value="restricted">Restricted</RadioGroupItem>
    </RadioGroup>
  );
}
