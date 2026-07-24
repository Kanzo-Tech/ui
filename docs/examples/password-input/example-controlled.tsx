"use client";

import { useState } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  const [value, setValue] = useState("");

  return (
    <Field className="w-72">
      <FieldLabel>API key</FieldLabel>
      {/* An API key is not a password: `ignorePasswordManagers` keeps 1Password and friends
          from offering to save it. */}
      <PasswordInput ignorePasswordManagers>
        <PasswordInputGroup>
          <PasswordInputInput
            onChange={(event) => setValue(event.target.value)}
            placeholder="sk-…"
            value={value}
          />
          <PasswordInputTrigger />
        </PasswordInputGroup>
      </PasswordInput>
      <FieldDescription>
        An API key is not a password, so password managers are kept out of it.
      </FieldDescription>
    </Field>
  );
}
