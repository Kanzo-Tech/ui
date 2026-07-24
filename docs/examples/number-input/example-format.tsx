import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  NumberInputLabel,
} from "@kanzo-tech/ui";

// `formatOptions` is forwarded straight to Ark, which feeds it to `Intl.NumberFormat` — the value
// stays a plain number, only the display is formatted (currency, percent, unit…).
export default function Example() {
  return (
    <div className="flex flex-wrap gap-4">
      <NumberInput
        className="w-40"
        defaultValue="1499.99"
        formatOptions={{ style: "currency", currency: "EUR" }}
        min={0}
        step={0.01}
      >
        <NumberInputLabel>Price</NumberInputLabel>
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>

      <NumberInput
        className="w-40"
        defaultValue="0.25"
        formatOptions={{ style: "percent" }}
        max={1}
        min={0}
        step={0.01}
      >
        <NumberInputLabel>Discount</NumberInputLabel>
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>

      <NumberInput
        className="w-40"
        defaultValue="16"
        formatOptions={{ style: "unit", unit: "gigabyte" }}
        min={0}
      >
        <NumberInputLabel>Storage</NumberInputLabel>
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>
    </div>
  );
}
