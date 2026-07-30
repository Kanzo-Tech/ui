"use client";

import { type DateValue, parseDate } from "@internationalized/date";
import {
  Button,
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const schema = z.object({
  embargoUntil: z
    .string()
    .min(1, "Pick an embargo date.")
    .refine((value) => value > "2026-01-01", "The embargo has to be in the future."),
});

// The form field stays a plain ISO string; only the picker sees a `DateValue`. The `catch` is
// load-bearing — a stored value that will not parse must leave the calendar empty rather than
// throw it, or one bad row takes down the form.
function toDateValues(iso: string): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDate(iso)];
  } catch {
    return [];
  }
}

export default function Example() {
  const form = useForm({
    defaultValues: { embargoUntil: "" },
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
        <form.Field name="embargoUntil">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Embargo until</FieldLabel>
              {/* DatePicker is one of the three controls that does not read `invalid` off the
                  Field context, so it takes its own. */}
              <DatePicker
                invalid={!field.state.meta.isValid}
                onValueChange={(details) => field.handleChange(details.valueAsString[0] ?? "")}
                positioning={{ placement: "bottom-end" }}
                value={toDateValues(field.state.value)}
              >
                <DatePickerInput />
                <DatePickerContent>
                  <CalendarView view="day">
                    <CalendarViewControl>
                      <CalendarPrevTrigger />
                      <CalendarMonthSelect />
                      <CalendarYearSelect />
                      <CalendarNextTrigger />
                    </CalendarViewControl>
                    <CalendarTable>
                      <CalendarWeekDays />
                      <CalendarTableDays />
                    </CalendarTable>
                  </CalendarView>
                </DatePickerContent>
              </DatePicker>
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
