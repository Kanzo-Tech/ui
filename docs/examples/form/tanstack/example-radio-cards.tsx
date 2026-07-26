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
import { DatabaseIcon, FileTextIcon, GlobeIcon } from "lucide-react";
import * as z from "zod";

const schema = z.object({
  source: z.enum(["file", "database", "endpoint"], {
    error: "Choose where the data comes from.",
  }),
});

const SOURCES = [
  { value: "file", label: "File", hint: "CSV or Parquet", Icon: FileTextIcon },
  {
    value: "database",
    label: "Database",
    hint: "Postgres or DuckDB",
    Icon: DatabaseIcon,
  },
  {
    value: "endpoint",
    label: "Endpoint",
    hint: "SPARQL or REST",
    Icon: GlobeIcon,
  },
];

export default function Example() {
  const form = useForm({
    defaultValues: { source: "" },
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
        <form.Field name="source">
          {(field) => {
            const invalid = !field.state.meta.isValid;

            return (
              <FieldSet>
                <FieldLegend variant="label">Source</FieldLegend>

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
                    {SOURCES.map(({ value, label, hint, Icon }) => (
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
