import { InputGroupText, NumberField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NumberField
      defaultValue={1000}
      iconEnd={<InputGroupText>rows</InputGroupText>}
      max={10_000}
      min={0}
      rootClassName="w-72"
      step={100}
    />
  );
}
