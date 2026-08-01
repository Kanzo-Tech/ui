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
  Show,
  Textarea,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod";

const schema = z.object({
  title: z
    .string()
    .min(10, "Give the contract a title a poster would recognise.")
    .max(60, "Keep the title under 60 characters."),
  notice: z.string().min(20, "Say what the party is walking into — at least 20 characters."),
});

export default function Example() {
  const [saved, setSaved] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { title: "", notice: "" },
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
        <form.Field name="title">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} required>
              <FieldLabel>
                Contract title
                <FieldRequiredIndicator />
              </FieldLabel>
              <Input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="A wyrm under the granary"
                value={field.state.value}
              />
              <FieldDescription>
                One line — it is what the board shows.
              </FieldDescription>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>

        <form.Field name="notice">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} required>
              <FieldLabel>
                Notice
                <FieldRequiredIndicator />
              </FieldLabel>
              <Textarea
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What the party is walking into, and who reported it."
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
              {isSubmitting ? "Posting…" : "Post"}
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

      <Show when={!!saved}>
        <p className="mt-3 font-mono text-muted-foreground text-xs">{saved}</p>
      </Show>
    </form>
  );
}
