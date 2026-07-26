"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupCard, RadioGroupText } from "@kanzo-tech/ui";

const VISIBILITIES = ["Public", "Private", "Restricted"];

export default function Example() {
  const [value, setValue] = useState("private");

  return (
    <div className="w-96">
      <RadioGroup
        className="text-center *:flex-col *:items-center *:justify-center"
        columns="auto"
        // Ark's handler, so a details object rather than a bare string — and
        // `details.value` is `string | null`, which `?? ""` keeps a string.
        onValueChange={(details) => setValue(details.value ?? "")}
        value={value}
      >
        {VISIBILITIES.map((label) => (
          <RadioGroupCard key={label} value={label.toLowerCase()}>
            <RadioGroupText>{label}</RadioGroupText>
          </RadioGroupCard>
        ))}
      </RadioGroup>

      <p className="mt-2 font-mono text-muted-foreground text-xs">{value}</p>
    </div>
  );
}
