"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel, SecretField } from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState("");

  return (
    <Field className="w-72">
      <FieldLabel>API key</FieldLabel>
      <SecretField
        ignorePasswordManagers
        onValueChange={setValue}
        placeholder="sk-…"
        value={value}
      />
      <FieldDescription>
        An API key is not a password, so password managers are kept out of it.
      </FieldDescription>
    </Field>
  );
}
