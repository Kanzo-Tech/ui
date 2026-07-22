"use client";

import {
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
} from "@kanzo-tech/ui";

/** Four different controls, composed identically. That sameness is the point of the pattern. */
export default function Example() {
  return (
    <FieldGroup className="w-full max-w-sm">
      <Field>
        <FieldLabel>Region</FieldLabel>
        <NativeSelect defaultValue="eu-west">
          <NativeSelectOption value="eu-west">EU West</NativeSelectOption>
          <NativeSelectOption value="us-east">US East</NativeSelectOption>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea placeholder="What this dataset contains…" rows={3} />
      </Field>

      <Field orientation="horizontal">
        <FieldLabel>Verify TLS certificates</FieldLabel>
        <Switch defaultChecked />
      </Field>

      <Field orientation="horizontal">
        <Checkbox />
        <FieldContent>
          <FieldTitle>Send weekly digest</FieldTitle>
          <FieldDescription>A summary of new datasets every Monday.</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
