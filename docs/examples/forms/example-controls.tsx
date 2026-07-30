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
        <NativeSelect defaultValue="Thornmarch">
          <NativeSelectOption value="Thornmarch">Thornmarch</NativeSelectOption>
          <NativeSelectOption value="Greenhollow">Greenhollow</NativeSelectOption>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel>Notice</FieldLabel>
        <Textarea placeholder="What the party is walking into…" rows={3} />
      </Field>

      <Field orientation="horizontal">
        <FieldLabel>Post to every hall</FieldLabel>
        <Switch defaultChecked />
      </Field>

      <Field orientation="horizontal">
        <Checkbox />
        <FieldContent>
          <FieldTitle>Send word when it is claimed</FieldTitle>
          <FieldDescription>A runner to the Amber Hall the day a party signs.</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
