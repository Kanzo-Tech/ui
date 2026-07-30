"use client";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  PinInput,
  PinInputControl,
  PinInputInput,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const CELLS = [0, 1, 2, 3, 4, 5];

const schema = z.object({
  seal: z
    .array(z.string())
    .refine((value) => value.join("").length === 6, "Enter all six figures."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { seal: [] as string[] },
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
        <form.Field name="seal">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Hall seal</FieldLabel>
              {/* One string per cell. `details.valueAsString` is the joined form if you
                  would rather keep a single string in form state. */}
              <PinInput
                name={field.name}
                onValueChange={(details) => field.handleChange(details.value)}
                otp
                value={field.state.value}
              >
                <PinInputControl>
                  {CELLS.map((index) => (
                    <PinInputInput index={index} key={index} />
                  ))}
                </PinInputControl>
              </PinInput>
              <FieldDescription>
                Six figures from the hall’s seal-book. A writ is not signed without one.
              </FieldDescription>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Seal
      </Button>
    </form>
  );
}
