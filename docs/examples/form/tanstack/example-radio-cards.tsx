"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  RadioGroup,
  RadioGroupCard,
  RadioGroupText,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { FootprintsIcon, MapIcon, SwordsIcon } from "lucide-react";
import * as z from "zod";

const schema = z.object({
  kind: z.enum(["escort", "bounty", "survey"], {
    error: "Choose the kind of work.",
  }),
});

const KINDS = [
  {
    value: "escort",
    label: "Escort",
    hint: "Somebody walks with them",
    Icon: FootprintsIcon,
  },
  { value: "bounty", label: "Bounty", hint: "Paid on the body", Icon: SwordsIcon },
  { value: "survey", label: "Survey", hint: "Walk it and report", Icon: MapIcon },
];

export default function Example() {
  const form = useForm({
    defaultValues: { kind: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: () => {},
  });

  return (
    <form
      className="w-full max-w-md"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="kind">
          {(field) => {
            const invalid = !field.state.meta.isValid;

            return (
              <FieldSet>
                <FieldLegend variant="label">Kind of work</FieldLegend>

                <Field invalid={invalid}>
                  <RadioGroup
                    className="text-center *:flex-col *:items-center *:justify-center"
                    columns="auto"
                    invalid={invalid}
                    name={field.name}
                    // Ark's handler: a details object whose `value` is `string | null`,
                    // so `?? ""` keeps the form value a string.
                    onValueChange={(details) =>
                      field.handleChange(details.value ?? "")
                    }
                    value={field.state.value}
                  >
                    {KINDS.map(({ value, label, hint, Icon }) => (
                      <RadioGroupCard key={value} value={value}>
                        <Icon className="size-5 shrink-0 text-muted-foreground" />
                        <RadioGroupText>{label}</RadioGroupText>
                        <span className="text-muted-foreground text-xs leading-snug">
                          {hint}
                        </span>
                      </RadioGroupCard>
                    ))}
                  </RadioGroup>

                  <FieldError>
                    {field.state.meta.errors
                      .map((issue) => issue?.message)
                      .join(", ")}
                  </FieldError>
                </Field>
              </FieldSet>
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
