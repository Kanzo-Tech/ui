import { InputGroupText, NumberField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NumberField
      defaultValue={32}
      iconEnd={<InputGroupText>gold</InputGroupText>}
      max={500}
      min={0}
      rootClassName="w-72"
      step={5}
    />
  );
}
