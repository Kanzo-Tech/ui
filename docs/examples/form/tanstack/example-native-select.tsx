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
import { REGIONS } from "@/example/world";

const schema = z.object({
  region: z.enum(REGIONS, { error: "Pick a region." }),
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
                {REGIONS.map((region) => (
                  <NativeSelectOption key={region} value={region}>
                    {region}
                  </NativeSelectOption>
                ))}
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
