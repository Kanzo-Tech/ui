"use client";

import { useState } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
} from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState("2");

  return (
    <Field className="w-56">
      <FieldLabel>Sightings reported</FieldLabel>
      <NumberInput
        min={0}
        max={20}
        onValueChange={(details) => setValue(details.value)}
        value={value}
      >
        <NumberInputControl>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>
      <FieldDescription>
        The value is a string; <code>onValueChange</code> also hands you{" "}
        <code>valueAsNumber</code>.
      </FieldDescription>
    </Field>
  );
}
