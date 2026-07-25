"use client";

import {
  Button,
  DateField,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  embargoUntil: z
    .string()
    .min(1, "Pick an embargo date.")
    .refine((value) => value > "2026-01-01", "The embargo has to be in the future."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { embargoUntil: "" },
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
        <form.Field name="embargoUntil">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Embargo until</FieldLabel>
              {/* DateField is the one control with a plain `onChange`: it keeps an ISO
                  string on the outside so nothing here has to know about Ark's date
                  objects. */}
              <DateField
                invalid={!field.state.meta.isValid}
                onChange={(value) => field.handleChange(value ?? "")}
                value={field.state.value || null}
              />
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
