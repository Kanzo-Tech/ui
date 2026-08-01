"use client";

import {
  Button,
  createListCollection,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";
import { HALLS } from "@/example/world";

const halls = createListCollection({
  items: HALLS.map((entry) => ({ label: entry.name, value: entry.id })),
});

const schema = z.object({
  hall: z.enum(["amber", "salt", "nine", "ash", "lanternwood"], {
    error: "Choose the hall that signs for this contract.",
  }),
});

export default function Example() {
  const form = useForm({
    defaultValues: { hall: "" },
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
        <form.Field name="hall">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Posting hall</FieldLabel>
              <Select
                collection={halls}
                name={field.name}
                onValueChange={(details) =>
                  field.handleChange(details.value[0] ?? "")
                }
                // Ark closes the listbox by moving focus back to the trigger, so the
                // trigger's own blur is the moment the field is "left".
                onOpenChange={(details) => {
                  if (!details.open) field.handleBlur();
                }}
                value={field.state.value ? [field.state.value] : []}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a hall" />
                </SelectTrigger>
                <SelectContent>
                  {halls.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
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
