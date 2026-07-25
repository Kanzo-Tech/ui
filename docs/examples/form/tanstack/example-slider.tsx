"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  Slider,
  SliderLabel,
  SliderValue,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  sampling: z
    .array(z.number())
    .length(1)
    .refine((value) => (value[0] ?? 0) >= 10, "Sample at least 10% of the rows."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { sampling: [5] },
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
        <form.Field name="sampling">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              {/* Slider's value is always an array — one entry per thumb — even for
                  a single-value slider. */}
              <Slider
                name={field.name}
                onValueChange={(details) => field.handleChange(details.value)}
                onValueChangeEnd={field.handleBlur}
                value={field.state.value}
              >
                <div className="flex items-center gap-2">
                  <SliderLabel>Sampling</SliderLabel>
                  <SliderValue />
                </div>
              </Slider>
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
