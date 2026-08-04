"use client";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Textarea,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  notice: z
    .string()
    .min(20, "Say a little more — at least 20 characters.")
    .max(280, "Keep it under 280 characters."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { notice: "" },
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
        <form.Field name="notice">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Notice</FieldLabel>
              <Textarea
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What the party is walking into."
                rows={4}
                value={field.state.value}
              />
              <FieldDescription>
                {field.state.value.length} / 280 characters.
              </FieldDescription>
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
