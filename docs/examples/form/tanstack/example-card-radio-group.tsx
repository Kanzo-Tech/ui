"use client";

import {
  Button,
  CardRadioGroup,
  Field,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { DatabaseIcon, FileTextIcon, GlobeIcon } from "lucide-react";
import * as z from "zod";

const schema = z.object({
  source: z.enum(["file", "database", "endpoint"], {
    error: "Choose where the data comes from.",
  }),
});

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
                  {/* Our own sugar, so the callback is a bare string rather than
                      Ark's details object. */}
                  <CardRadioGroup
                    invalid={invalid}
                    name={field.name}
                    onValueChange={field.handleChange}
                    options={[
                      {
                        value: "file",
                        label: "File",
                        description: "CSV or Parquet",
                        icon: <FileTextIcon />,
                      },
                      {
                        value: "database",
                        label: "Database",
                        description: "Postgres or DuckDB",
                        icon: <DatabaseIcon />,
                      },
                      {
                        value: "endpoint",
                        label: "Endpoint",
                        description: "SPARQL or REST",
                        icon: <GlobeIcon />,
                      },
                    ]}
                    value={field.state.value}
                  />

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
