import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  NumberInputLabel,
} from "@kanzo-tech/ui";

// `formatOptions` is forwarded straight to Ark, which feeds it to `Intl.NumberFormat` — the value
// stays a plain number, only the display is formatted (currency, percent, unit…). `XAU` is gold,
// which is the only coin the board pays in.
export default function Example() {
  return (
    <div className="flex flex-wrap gap-4">
      <NumberInput
        className="w-40"
        defaultValue="32"
        formatOptions={{ style: "currency", currency: "XAU" }}
        min={0}
        step={1}
      >
        <NumberInputLabel>Reward</NumberInputLabel>
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
        step={0.05}
      >
        <NumberInputLabel>Paid on signing</NumberInputLabel>
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>

      <NumberInput
        className="w-40"
        defaultValue="11"
        formatOptions={{ style: "unit", unit: "day" }}
        min={0}
      >
        <NumberInputLabel>Travel</NumberInputLabel>
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>
    </div>
  );
}
