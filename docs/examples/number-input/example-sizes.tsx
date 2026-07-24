import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-40 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <NumberInput defaultValue="3" key={size} min={0}>
          <NumberInputControl size={size}>
            <NumberInputInput />
            <NumberInputIncrementTrigger />
            <NumberInputDecrementTrigger />
          </NumberInputControl>
        </NumberInput>
      ))}
    </div>
  );
}
