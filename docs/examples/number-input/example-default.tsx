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
    <NumberInput className="w-40" defaultValue="3" min={1} max={5}>
      <NumberInputLabel>Party size</NumberInputLabel>
      <NumberInputControl>
        <NumberInputInput />
        <NumberInputIncrementTrigger />
        <NumberInputDecrementTrigger />
      </NumberInputControl>
    </NumberInput>
  );
}
