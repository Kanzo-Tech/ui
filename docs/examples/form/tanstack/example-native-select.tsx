"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  region: z.enum(["eu-west", "eu-central", "us-east"], {
    error: "Pick a region.",
  }),
});

export default function Example() {
  const form = useForm({
    defaultValues: { region: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: () => {},
  });

  return (
    <form
      className="w-full max-w-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="region">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Region</FieldLabel>
              <NativeSelect
                className="w-full"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">Select a region</NativeSelectOption>
                <NativeSelectOption value="eu-west">EU West</NativeSelectOption>
                <NativeSelectOption value="eu-central">
                  EU Central
                </NativeSelectOption>
                <NativeSelectOption value="us-east">US East</NativeSelectOption>
              </NativeSelect>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
