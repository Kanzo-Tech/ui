"use client";

import {
  Button,
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerSlider,
  ColorPickerTrigger,
  ColorPickerValueSwatch,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Pick a colour.")
    .refine((value) => value.toLowerCase() !== "#ffffff", "White has no contrast."),
});

export default function Example() {
  const form = useForm({
    // Never "": the control parses this string on every render, so it has to stay
    // a valid colour.
    defaultValues: { accent: "#7c3aed" },
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
        <form.Field name="accent">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Accent colour</FieldLabel>
              <ColorPicker
                name={field.name}
                // `details.valueAsString` follows the machine's format, which is rgba —
                // ask the Color object for hex if that is what you store.
                onValueChange={(details) =>
                  field.handleChange(details.value.toString("hex"))
                }
                value={field.state.value}
              >
                <ColorPickerControl>
                  <ColorPickerTrigger asChild>
                    <Button variant="outline">
                      <ColorPickerValueSwatch className="size-4" />
                      {field.state.value}
                    </Button>
                  </ColorPickerTrigger>
                </ColorPickerControl>

                <ColorPickerContent>
                  <ColorPickerArea>
                    <ColorPickerAreaThumb />
                  </ColorPickerArea>
                  <ColorPickerSlider channel="hue" />
                </ColorPickerContent>
              </ColorPicker>
              <FieldDescription>
                Stored as {field.state.value}.
              </FieldDescription>
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
