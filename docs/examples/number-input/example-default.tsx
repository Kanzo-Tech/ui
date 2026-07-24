import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  NumberInputLabel,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NumberInput className="w-40" defaultValue="3" min={0} max={99}>
      <NumberInputLabel>Quantity</NumberInputLabel>
      <NumberInputControl>
        <NumberInputInput />
        <NumberInputIncrementTrigger />
        <NumberInputDecrementTrigger />
      </NumberInputControl>
    </NumberInput>
  );
}
