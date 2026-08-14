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
  Show,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { XIcon } from "lucide-react";
import * as z from "zod";
import { MEMBERS } from "@/example/people";

const HANDLES = new Set<string>(MEMBERS.map((candidate) => candidate.handle));

const schema = z.object({
  party: z
    .array(
      z.object({
        id: z.string(),
        handle: z
          .string()
          .refine((value) => HANDLES.has(value), "No member of the guild by that handle."),
      })
    )
    .min(1, "Somebody has to walk it.")
    .max(5, "Five to a party at most."),
});

// A row carries its own key from the moment it is created, so removing a row in the
// middle never remounts the ones below it.
let counter = 0;
const newSignatory = () => ({ id: `signatory-${++counter}`, handle: "" });

export default function Example() {
  const form = useForm({
    defaultValues: { party: [newSignatory()] },
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
      <form.Field mode="array" name="party">
        {(array) => (
          <FieldSet>
            <FieldLegend variant="label">Party</FieldLegend>
            <FieldDescription>
              Up to five who sign for this contract.
            </FieldDescription>

            <FieldGroup>
              {array.state.value.map((signatory, index) => (
                <form.Field key={signatory.id} name={`party[${index}].handle`}>
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
                            placeholder="ravenna"
                            value={field.state.value}
                          />
                          <Show when={array.state.value.length > 1}>
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                aria-label={`Remove signatory ${index + 1}`}
                                onClick={() => array.removeValue(index)}
                                size="icon-sm"
                              >
                                <XIcon />
                              </InputGroupButton>
                            </InputGroupAddon>
                          </Show>
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
              onClick={() => array.pushValue(newSignatory())}
              size="sm"
              type="button"
              variant="outline"
            >
              Add member
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
