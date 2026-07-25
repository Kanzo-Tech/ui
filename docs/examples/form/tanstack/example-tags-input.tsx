"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  TagsInputLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  keywords: z
    .array(z.string().min(2, "Keywords need at least two characters."))
    .min(1, "Add at least one keyword.")
    .max(5, "Five keywords at most."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { keywords: ["air-quality"] },
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
        <form.Field name="keywords">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <TagsInput
                max={5}
                name={field.name}
                onValueChange={(details) => field.handleChange(details.value)}
                value={field.state.value}
              >
                <TagsInputLabel>Keywords</TagsInputLabel>
                <TagsInputControl>
                  <TagsInputContext>
                    {(api) =>
                      api.value.map((value, index) => (
                        <TagsInputItem
                          index={index}
                          key={`${value}-${index}`}
                          value={value}
                        >
                          <TagsInputItemPreview>
                            <TagsInputItemText>{value}</TagsInputItemText>
                            <TagsInputItemDeleteTrigger />
                          </TagsInputItemPreview>
                          <TagsInputItemInput />
                        </TagsInputItem>
                      ))
                    }
                  </TagsInputContext>
                  <TagsInputInput
                    onBlur={field.handleBlur}
                    placeholder="Add keyword…"
                  />
                </TagsInputControl>
              </TagsInput>
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
