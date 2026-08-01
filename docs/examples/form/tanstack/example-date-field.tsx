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
import { isoDay } from "@/example/world";

const schema = z.object({
  dueBy: z
    .string()
    .min(1, "Pick a due date.")
    .refine((value) => value > isoDay(0), "A contract cannot be due before it is posted."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { dueBy: "" },
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
        <form.Field name="dueBy">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Due by</FieldLabel>
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
