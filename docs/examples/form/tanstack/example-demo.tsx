"use client";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldRequiredIndicator,
  Input,
  Textarea,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod";

const schema = z.object({
  name: z
    .string()
    .min(3, "Give the dataset a name of at least 3 characters.")
    .max(48, "Keep the name under 48 characters."),
  summary: z.string().min(20, "Describe the dataset in at least 20 characters."),
});

export default function Example() {
  const [saved, setSaved] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", summary: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setSaved(JSON.stringify(value)),
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
        <form.Field name="name">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} required>
              <FieldLabel>
                Dataset name
                <FieldRequiredIndicator />
              </FieldLabel>
              <Input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="air-quality-2024"
                value={field.state.value}
              />
              <FieldDescription>
                Lowercase letters, numbers and hyphens.
              </FieldDescription>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field name="summary">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} required>
              <FieldLabel>
                Summary
                <FieldRequiredIndicator />
              </FieldLabel>
              <Textarea
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What this dataset contains, and where it came from."
                rows={3}
                value={field.state.value}
              />
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <div className="mt-6 flex items-center gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Publishing…" : "Publish"}
            </Button>
          )}
        </form.Subscribe>

        <Button
          onClick={() => {
            form.reset();
            setSaved(null);
          }}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {saved && (
        <p className="mt-3 font-mono text-muted-foreground text-xs">{saved}</p>
      )}
    </form>
  );
}
