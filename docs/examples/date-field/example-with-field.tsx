"use client";

import { useState } from "react";
import { DateField, Field, FieldDescription, FieldLabel } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Field className="w-64">
      <FieldLabel>Due by</FieldLabel>
      <DateField onChange={setValue} value={value} />
      <FieldDescription>
        Keyboard-navigable grid, with month and year quick-nav.
      </FieldDescription>
    </Field>
  );
}
