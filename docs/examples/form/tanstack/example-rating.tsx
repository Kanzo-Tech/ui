"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  Rating,
  RatingContext,
  RatingControl,
  RatingItem,
  RatingLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  grade: z.number().min(1, "Grade the contract before posting it."),
});

export default function Example() {
  const form = useForm({
    defaultValues: { grade: 0 },
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
        <form.Field name="grade">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <Rating
                count={5}
                name={field.name}
                onValueChange={(details) => field.handleChange(details.value)}
                value={field.state.value}
              >
                <RatingLabel>Grade</RatingLabel>
                <RatingControl>
                  <RatingContext>
                    {(api) =>
                      api.items.map((index) => (
                        <RatingItem index={index} key={index} />
                      ))
                    }
                  </RatingContext>
                </RatingControl>
              </Rating>
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
