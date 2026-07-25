"use client";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

// The machine's value is a string, so the form value stays a string and the schema
// converts. Start at `z.string()` and pipe: `z.coerce.number()` has an input type of
// `unknown`, which does not match the form's shape and will not typecheck.
// `schema.parse(value)` on submit gives you the typed payload.
const schema = z.object({
  replicas: z
    .string()
    .min(1, "Enter a number of replicas.")
    .transform(Number)
    .pipe(
      z
        .number({ error: "Not a number." })
        .int("Whole numbers only.")
        .min(1, "At least one replica.")
        .max(9, "Nine replicas at most.")
    ),
});

export default function Example() {
  const form = useForm({
    defaultValues: { replicas: "3" },
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
        <form.Field name="replicas">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Replicas</FieldLabel>
              <NumberInput
                max={9}
                min={1}
                name={field.name}
                onValueChange={(details) => field.handleChange(details.value)}
                value={field.state.value}
              >
                <NumberInputControl>
                  <NumberInputInput onBlur={field.handleBlur} />
                  <NumberInputIncrementTrigger />
                  <NumberInputDecrementTrigger />
                </NumberInputControl>
              </NumberInput>
              <FieldDescription>
                Form value: {JSON.stringify(field.state.value)} — a string, always.
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
