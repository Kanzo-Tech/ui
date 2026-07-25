"use client";

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "parquet", label: "Parquet" },
  { value: "jsonl", label: "JSON Lines" },
];

const schema = z.object({
  terms: z.literal(true, { error: "You have to accept the terms." }),
  formats: z.array(z.string()).min(1, "Pick at least one export format."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { terms: false, formats: [] as string[] },
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
        <form.Field name="terms">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} orientation="horizontal">
              <Checkbox
                checked={field.state.value}
                name={field.name}
                onCheckedChange={(details) =>
                  field.handleChange(details.checked === true)
                }
              />
              <FieldContent>
                <FieldTitle>Accept the terms of use</FieldTitle>
                <FieldDescription>
                  Redistribution requires attribution.
                </FieldDescription>
                <FieldError>
                  {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
                </FieldError>
              </FieldContent>
            </Field>
          )}
        </form.Field>

        <form.Field name="formats">
          {(field) => (
            <FieldSet>
              <FieldLegend variant="label">Export formats</FieldLegend>

              <Field invalid={!field.state.meta.isValid}>
                <CheckboxGroup
                  // The one Ark control whose callback takes a bare value, not a
                  // details object.
                  onValueChange={(value) => field.handleChange(value)}
                  value={field.state.value}
                >
                  {FORMATS.map((format) => (
                    <Field key={format.value} orientation="horizontal">
                      <Checkbox value={format.value} />
                      <FieldLabel>{format.label}</FieldLabel>
                    </Field>
                  ))}
                </CheckboxGroup>

                <FieldError>
                  {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
                </FieldError>
              </Field>
            </FieldSet>
          )}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
