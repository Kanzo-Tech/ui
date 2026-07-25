"use client";

import {
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Switch,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  verifyTls: z.boolean(),
  publish: z.literal(true, {
    error: "The dataset has to be published for the sync to run.",
  }),
});

export default function Example() {
  const form = useForm({
    defaultValues: { verifyTls: true, publish: false },
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
        <form.Field name="verifyTls">
          {(field) => (
            <Field orientation="horizontal">
              <FieldLabel>Verify TLS certificates</FieldLabel>
              <Switch
                checked={field.state.value}
                name={field.name}
                onCheckedChange={(details) => field.handleChange(details.checked)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="publish">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} orientation="horizontal">
              <FieldContent>
                <FieldLabel>Publish on save</FieldLabel>
                <FieldDescription>
                  Anyone with the link will be able to read it.
                </FieldDescription>
                <FieldError>
                  {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
                </FieldError>
              </FieldContent>
              <Switch
                checked={field.state.value}
                name={field.name}
                onCheckedChange={(details) => field.handleChange(details.checked)}
              />
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
