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
  sendWord: z.boolean(),
  post: z.literal(true, {
    error: "The contract has to be posted before anyone can claim it.",
  }),
});

export default function Example() {
  const form = useForm({
    defaultValues: { sendWord: true, post: false },
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
        <form.Field name="sendWord">
          {(field) => (
            <Field orientation="horizontal">
              <FieldLabel>Send word when it is claimed</FieldLabel>
              <Switch
                checked={field.state.value}
                name={field.name}
                onCheckedChange={(details) => field.handleChange(details.checked)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="post">
          {(field) => (
            <Field invalid={!field.state.meta.isValid} orientation="horizontal">
              <FieldContent>
                <FieldLabel>Post to the board</FieldLabel>
                <FieldDescription>
                  Any chartered hall will be able to claim it.
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
