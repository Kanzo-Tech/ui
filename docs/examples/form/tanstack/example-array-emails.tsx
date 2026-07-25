"use client";

import {
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { XIcon } from "lucide-react";
import * as z from "zod";

const schema = z.object({
  contacts: z
    .array(
      z.object({
        id: z.string(),
        address: z.email("Enter a valid email address."),
      })
    )
    .min(1, "Add at least one contact.")
    .max(5, "Five contacts at most."),
});

// A row carries its own key from the moment it is created, so removing a row in the
// middle never remounts the ones below it.
let counter = 0;
const newContact = () => ({ id: `contact-${++counter}`, address: "" });

export default function Example() {
  const form = useForm({
    defaultValues: { contacts: [newContact()] },
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
      <form.Field mode="array" name="contacts">
        {(array) => (
          <FieldSet>
            <FieldLegend variant="label">Contacts</FieldLegend>
            <FieldDescription>
              Up to five addresses we can reach you at.
            </FieldDescription>

            <FieldGroup>
              {array.state.value.map((contact, index) => (
                <form.Field key={contact.id} name={`contacts[${index}].address`}>
                  {(field) => (
                    <Field invalid={!field.state.meta.isValid}>
                      <FieldContent>
                        <InputGroup>
                          <InputGroupInput
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            placeholder="name@example.org"
                            value={field.state.value}
                          />
                          {array.state.value.length > 1 && (
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                aria-label={`Remove contact ${index + 1}`}
                                onClick={() => array.removeValue(index)}
                                size="icon-xs"
                              >
                                <XIcon />
                              </InputGroupButton>
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                        <FieldError>
                          {field.state.meta.errors
                            .map((issue) => issue?.message)
                            .join(", ")}
                        </FieldError>
                      </FieldContent>
                    </Field>
                  )}
                </form.Field>
              ))}
            </FieldGroup>

            {/* The array field itself carries the `.min()` / `.max()` errors — the ones
                that belong to the list rather than to any one row. */}
            <Field invalid={!array.state.meta.isValid}>
              <FieldError>
                {array.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>

            <Button
              className="w-fit"
              disabled={array.state.value.length >= 5}
              onClick={() => array.pushValue(newContact())}
              size="sm"
              type="button"
              variant="outline"
            >
              Add contact
            </Button>
          </FieldSet>
        )}
      </form.Field>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
