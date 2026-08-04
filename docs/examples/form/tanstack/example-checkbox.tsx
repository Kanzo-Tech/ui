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
import { HALLS } from "@/example/world";

const CLAIMANTS = HALLS.map((entry) => ({ value: entry.id, label: entry.short }));

const schema = z.object({
  orders: z.literal(true, { error: "You have to accept the standing orders." }),
  halls: z.array(z.string()).min(1, "Somebody has to be able to claim it."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { orders: false, halls: [] as string[] },
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
        <form.Field name="orders">
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
                <FieldTitle>Accept the hall’s standing orders</FieldTitle>
                <FieldDescription>
                  Checked when a party signs, and again when it comes back.
                </FieldDescription>
                <FieldError>
                  {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
                </FieldError>
              </FieldContent>
            </Field>
          )}
        </form.Field>

        <form.Field name="halls">
          {(field) => (
            <FieldSet>
              <FieldLegend variant="label">Who may claim it</FieldLegend>

              <Field invalid={!field.state.meta.isValid}>
                <CheckboxGroup
                  // The one Ark control whose callback takes a bare value, not a
                  // details object.
                  onValueChange={(value) => field.handleChange(value)}
                  value={field.state.value}
                >
                  {CLAIMANTS.map((claimant) => (
                    <Field key={claimant.value} orientation="horizontal">
                      <Checkbox value={claimant.value} />
                      <FieldLabel>{claimant.label}</FieldLabel>
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
