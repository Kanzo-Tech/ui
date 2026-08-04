"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  RadioGroup,
  RadioGroupItem,
  RadioGroupLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  outcome: z.enum(["settled", "failed", "afield"], {
    error: "Say how the contract ended.",
  }),
});

export default function Example() {
  const form = useForm({
    defaultValues: { outcome: "" },
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
        <form.Field name="outcome">
          {(field) => {
            const invalid = !field.state.meta.isValid;

            return (
              <Field invalid={invalid}>
                {/* RadioGroup does not read Field context — `invalid` is repeated here
                    so the control itself turns red, and the label comes from
                    RadioGroupLabel so the machine owns the association. */}
                <RadioGroup
                  invalid={invalid}
                  name={field.name}
                  onValueChange={(details) =>
                    field.handleChange(details.value ?? "")
                  }
                  value={field.state.value}
                >
                  <RadioGroupLabel>Outcome</RadioGroupLabel>
                  <RadioGroupItem value="settled">Settled</RadioGroupItem>
                  <RadioGroupItem value="failed">Failed</RadioGroupItem>
                  <RadioGroupItem value="afield">Still afield</RadioGroupItem>
                </RadioGroup>

                <FieldError>
                  {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
                </FieldError>
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
