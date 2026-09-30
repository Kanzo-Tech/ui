"use client";

import {
  DatePicker as ArkDatePicker,
  useDatePickerContext,
} from "@ark-ui/react/date-picker";
import { type UseFieldContext, useFieldContext } from "@ark-ui/react/field";
import { DateInput as ArkDateInput } from "@ark-ui/react/date-input";
import { Portal } from "@ark-ui/react/portal";
import { useLocale } from "./locale";
import { CalendarIcon, ClockIcon } from "lucide-react";
import {
  CalendarDate,
  CalendarDateTime,
  type DateValue,
  parseDateTime,
  toCalendarDateTime,
} from "@internationalized/date";
import { createContext, useContext } from "react";
import type React from "react";
import { cn } from "../lib/cn";
import {
  Calendar,
  CalendarPresetTrigger,
} from "./calendar";
import type { Input, InputProps } from "./input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";

export const useDatePicker = useDatePickerContext;

/**
 * What the picker holds. `"day"` is a date; `"minute"` and `"second"` are a date **and** a time —
 * one value, one input, one popover.
 */
export type DatePickerGranularity = "day" | "minute" | "second";

// Provided by `DatePicker` and read by `DatePickerInput` and `DatePickerTimer`, which is how they
// know they are inside a timed picker (and so edit the picker's value) rather than standing alone.
// A context of ours rather than a probe of Ark's, whose hook throws outside a picker.
const TimedContext = createContext<TimedPicker | null>(null);

/**
 * What a timed picker's input needs from the picker around it: its own machine reads none of this,
 * because that input is Ark's segmented `DateInput`, a second machine bound to the picker's value.
 */
interface TimedPicker {
  granularity: Exclude<DatePickerGranularity, "day">;
  locale: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  min?: DateValue;
  max?: DateValue;
}

const CLOCK = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m?\.?)?/i;

/**
 * A date and a time read from pasted text: an ISO string (`2026-03-14T18:30`), or the locale's own
 * order (`14/03/2026 18:30`, `3/14/2026, 6:30 PM`). Ark's segments take a paste only as a bare ISO
 * date and drop it silently otherwise, which is the one thing a segmented field owes a form that
 * receives a copied timestamp. A date with no time keeps the time of `kept`, and is midnight
 * without one. `undefined` for anything that is not a date.
 */
function parsePasted(text: string, locale: string, kept?: DateValue): DateValue | undefined {
  try {
    return parseDateTime(text.replace(/(Z|[+-]\d{2}:\d{2})$/, ""));
  } catch {
    // Not ISO: read it in the locale's field order.
  }
  const clock = CLOCK.exec(text);
  const numbers = text.replace(clock?.[0] ?? "", " ").match(/\d+/g)?.map(Number);
  if (numbers?.length !== 3) return undefined;
  const yearFirst = /^\D*\d{4}\b/.test(text);
  const order = yearFirst
    ? ["year", "month", "day"]
    : new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(2001, 10, 22))
        .map((part) => part.type)
        .filter((type) => type === "year" || type === "month" || type === "day");
  const at = (type: string) => numbers[order.indexOf(type)] as number;
  const held = kept && "hour" in kept ? kept : undefined;
  let hour = Number(clock?.[1] ?? held?.hour ?? 0);
  if (clock?.[4]) hour = (hour % 12) + (clock[4].toLowerCase() === "p" ? 12 : 0);
  const minute = Number(clock?.[2] ?? held?.minute ?? 0);
  const second = Number(clock?.[3] ?? held?.second ?? 0);
  const date = new CalendarDate(at("year"), at("month"), at("day"));
  if (date.month !== at("month") || date.day !== at("day") || hour > 23 || minute > 59) {
    return undefined;
  }
  return new CalendarDateTime(date.year, date.month, date.day, hour, minute, second);
}

export interface DatePickerProps extends React.ComponentProps<typeof Calendar> {
  /**
   * What the picker holds. With `"minute"` or `"second"` the value is a date **and** a time: the
   * input is segmented — day, month, year, hour, minute in the locale's order and clock — so both can
   * be typed from empty, picking a day keeps the time, a
   * `DatePickerTimer` in the popover sets the time, and the popover stays open after a day is
   * picked so the time can be set. The value is then a `CalendarDateTime` — build one with
   * `parseDateTime` — and a day picked while there is none arrives at midnight.
   *
   * @default "day"
   */
  granularity?: DatePickerGranularity;
}

// Ark's `useDatePicker` reads no `useFieldContext` (it takes environment and locale only), so a
// `Field disabled` greyed the input while the popover still opened and a click still wrote a value.
// Bridged here the way `RadioGroup` does it: state flags only, explicit props win, and with no
// `Field` ancestor every flag is `undefined`, which Ark strips before the machine sees it.
export const DatePicker = (props: DatePickerProps) => {
  const {
    granularity = "day",
    positioning = { placement: "top" },
    onValueChange,
    slot,
    ...rest
  } = props;

  const field: UseFieldContext | undefined = useFieldContext();
  const timed = granularity !== "day";
  const { locale: contextLocale } = useLocale();
  const disabled = rest.disabled ?? field?.disabled;
  const invalid = rest.invalid ?? field?.invalid;
  const readOnly = rest.readOnly ?? field?.readOnly;
  const required = rest.required ?? field?.required;

  return (
    <TimedContext
      value={
        timed
          ? {
              granularity,
              locale: rest.locale ?? contextLocale,
              name: rest.name,
              disabled,
              readOnly,
              invalid,
              required,
              min: rest.min,
              max: rest.max,
            }
          : null
      }
    >
      <Calendar
        closeOnSelect={!timed}
        disabled={field?.disabled}
        inline={false}
        invalid={field?.invalid}
        positioning={positioning}
        readOnly={field?.readOnly}
        required={field?.required}
        {...rest}
        onValueChange={
          timed
            ? (details) =>
                onValueChange?.({
                  ...details,
                  value: details.value.map((v) => toCalendarDateTime(v)),
                })
            : onValueChange
        }
        slot={slot ?? "date-picker"}
      />
    </TimedContext>
  );
};

export const DatePickerTrigger = (
  props: React.ComponentProps<typeof ArkDatePicker.Trigger>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkDatePicker.Control data-slot="date-picker-control">
      <ArkDatePicker.Trigger
        className={cn(
          "justify-start",
          "text-start data-placeholder-shown:[&>span]:text-muted-foreground",
          "active:scale-100",
          "[&_svg:not([class*='text-'])]:opacity-64",
          className
        )}
        {...rest}
        data-slot={slot ?? "date-picker-trigger"}
      >
        {children}
      </ArkDatePicker.Trigger>
    </ArkDatePicker.Control>
  );
};

interface DatePickerInputProps
  extends Omit<React.ComponentProps<typeof ArkDatePicker.Input>, "size">,
    InputProps {}

/**
 * The picker's field, and the calendar button beside it.
 *
 * In a date picker it is a text input that reads what is typed in the locale's date format. In one
 * with a `granularity` it is **segmented** — day, month, year, hour, minute and, in a 12-hour
 * locale, AM/PM, each its own editable part in the locale's order — because a date and a time cannot
 * be typed as one string: Ark's date input admits only digits and the date separator, so a `:` or
 * `PM` never gets in. The segments are Ark's `DateInput`, bound to the picker's value both ways.
 */
export const DatePickerInput = (props: DatePickerInputProps) => {
  const timed = useContext(TimedContext);
  return timed ? <SegmentedInput {...props} timed={timed} /> : <TextInput {...props} />;
};

const CalendarButton = () => (
  <InputGroupAddon align="inline-end">
    <ArkDatePicker.Trigger asChild>
      <InputGroupButton size="icon-sm" slot="date-picker-trigger" variant="ghost">
        <CalendarIcon aria-hidden className="text-muted-foreground" />
      </InputGroupButton>
    </ArkDatePicker.Trigger>
  </InputGroupAddon>
);

const TextInput = (props: DatePickerInputProps) => {
  const { size, slot, ...rest } = props;

  return (
    <ArkDatePicker.Control data-slot="date-picker-control">
      <InputGroup size={size}>
        <ArkDatePicker.Input asChild {...rest}>
          <InputGroupInput slot={slot ?? "date-picker-input"} />
        </ArkDatePicker.Input>
        <CalendarButton />
      </InputGroup>
    </ArkDatePicker.Control>
  );
};

const SegmentedInput = (props: DatePickerInputProps & { timed: TimedPicker }) => {
  const { size, slot, timed, className, "aria-label": ariaLabel } = props;
  const api = useDatePickerContext();

  return (
    <ArkDatePicker.Control data-slot="date-picker-control">
      <InputGroup size={size}>
        <ArkDateInput.Root
          aria-invalid={timed.invalid || undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center self-stretch px-3",
            "text-base md:text-sm",
            className
          )}
          data-slot={slot ?? "date-picker-input"}
          disabled={timed.disabled}
          granularity={timed.granularity}
          invalid={timed.invalid}
          locale={timed.locale}
          max={timed.max}
          min={timed.min}
          name={timed.name}
          onValueChange={(details) => {
            const [value] = details.value;
            api.setValue(value ? [toCalendarDateTime(value)] : []);
          }}
          onPaste={(event) => {
            const pasted = parsePasted(
              event.clipboardData.getData("text/plain").trim(),
              timed.locale,
              api.value[0]
            );
            if (pasted) api.setValue([pasted]);
          }}
          readOnly={timed.readOnly}
          required={timed.required}
          value={api.value.map((v) => toCalendarDateTime(v))}
        >
          <ArkDateInput.Control className="flex min-w-0 items-center" data-slot="date-picker-segments">
            <ArkDateInput.SegmentGroup aria-label={ariaLabel} className="flex items-center gap-px">
              <ArkDateInput.SegmentContext>
                {(segment) => (
                  <ArkDateInput.Segment
                    className={cn(
                      "tabular-nums",
                      "rounded-sm px-0.5 outline-none",
                      "focus:bg-primary focus:text-primary-foreground",
                      "data-placeholder-shown:text-faint",
                      "data-[type=literal]:select-none data-[type=literal]:px-px data-[type=literal]:text-muted-foreground",
                      "data-readonly:cursor-default",
                      "group-data-invalid/input-group:text-destructive-foreground",
                      "group-data-invalid/input-group:focus:bg-destructive group-data-invalid/input-group:focus:text-destructive-content"
                    )}
                    data-slot="date-picker-segment"
                    // The separators are the runtime's (`Intl`), and the server's and the browser's
                    // ICU can disagree on which space one is.
                    segment={segment}
                    suppressHydrationWarning
                  />
                )}
              </ArkDateInput.SegmentContext>
            </ArkDateInput.SegmentGroup>
          </ArkDateInput.Control>
          <ArkDateInput.HiddenInput />
        </ArkDateInput.Root>
        <CalendarButton />
      </InputGroup>
    </ArkDatePicker.Control>
  );
};

export interface DatePickerTimerProps
  extends Omit<React.ComponentProps<typeof Input>, "size" | "step" | "type"> {
  /**
   * The control height, one of the shared sizes.
   *
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * The step of the time input **in seconds**, as on `<input type="time">`: `60` shows hours and
   * minutes, `1` adds seconds. Inside a `DatePicker` it follows the picker's `granularity`.
   *
   * @default 60
   */
  step?: number;
}

const two = (n: number) => String(n).padStart(2, "0");

/**
 * A time field: an `InputGroup` around `<input type="time">` with a clock addon.
 *
 * **Inside a `DatePicker`'s `DatePickerContent` it is the picker's time**, and the picker is one
 * date-and-time field: the timer shows the hour and minute of the picker's value and setting it
 * sets the picker's value, so the input above and the calendar beside it follow. Choosing a time
 * before any date takes the day the calendar is showing. **Anywhere else it is a plain time input**
 * you control with `value` and `onChange`.
 *
 * Props go where they read naturally: `size` and the field state (`disabled`, `invalid`, `readOnly`,
 * `required`, taken from an ancestor `Field` unless given) apply to the field, `className` and every
 * other prop go to the `<input>` itself — so `aria-label`, `name` and `onChange` do what they say.
 * The group around it is `w-full`; size it with the element you put it in.
 */
export const DatePickerTimer = (props: DatePickerTimerProps) => {
  const timed = useContext(TimedContext);
  return timed ? (
    <PickerTimer granularity={timed.granularity} {...props} />
  ) : (
    <TimeInput {...props} />
  );
};

const PickerTimer = (
  props: DatePickerTimerProps & { granularity: DatePickerGranularity }
) => {
  const { granularity, step, onChange, ...rest } = props;
  const api = useDatePickerContext();
  const current = api.value[0];
  const seconds = (step ?? (granularity === "second" ? 1 : 60)) < 60;
  const time = current && "hour" in current ? current : undefined;
  const text = time
    ? `${two(time.hour)}:${two(time.minute)}${seconds ? `:${two(time.second)}` : ""}`
    : `00:00${seconds ? ":00" : ""}`;

  return (
    <TimeInput
      {...rest}
      onChange={(event) => {
        onChange?.(event);
        const [hour, minute, second = 0] = event.target.value.split(":").map(Number);
        if (hour === undefined || minute === undefined) return;
        api.setValue([
          toCalendarDateTime(current ?? api.focusedValue).set({ hour, minute, second }),
        ]);
      }}
      step={step ?? (granularity === "second" ? 1 : 60)}
      value={text}
    />
  );
};

const TimeInput = (props: DatePickerTimerProps) => {
  const { size, step = 60, className, ...rest } = props;
  const field: UseFieldContext | undefined = useFieldContext();

  return (
    <InputGroup size={size}>
      <InputGroupAddon>
        <ClockIcon />
      </InputGroupAddon>
      <InputGroupInput
        // Not the field's `id`: the label of a `Field` names the date input, and a second element
        // with that id would steal it.
        aria-invalid={field?.invalid || undefined}
        className={cn(
          "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
          className
        )}
        disabled={field?.disabled}
        readOnly={field?.readOnly}
        required={field?.required}
        {...rest}
        step={step}
        type="time"
      />
    </InputGroup>
  );
};

export const DatePickerContent = (
  props: React.ComponentProps<typeof ArkDatePicker.Content>
) => {
  const { className, slot, ...rest } = props;

  return (
    <Portal>
      <ArkDatePicker.Positioner data-slot="date-picker-positioner">
        <ArkDatePicker.Content
          className={cn(
            "[--cell-size:--spacing(8)]",
            "z-[calc(50+var(--layer-index,0))]",
            "w-fit min-w-72",
            "p-3",
            "bg-popover",
            "text-popover-foreground",
            "rounded-box border shadow-lg/5",
            "outline-none",
            "origin-(--transform-origin)",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[state=closed]:zoom-out-[98%] data-[state=open]:zoom-in-[98%]",
            "motion-reduce:animate-none!",
            className
          )}
          {...rest}
          data-slot={slot ?? "date-picker-content"}
        />
      </ArkDatePicker.Positioner>
    </Portal>
  );
};

export const DatePickerValue = (
  props: React.ComponentProps<typeof ArkDatePicker.ValueText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkDatePicker.ValueText
      className={cn("font-medium text-sm", className)}
      {...rest}
      data-slot={slot ?? "date-picker-value"}
    />
  );
};

export const DatePickerPresetTrigger = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkDatePicker.PresetTrigger>) => (
  <CalendarPresetTrigger
    {...rest}
    slot={slot ?? "date-picker-preset-trigger"}
  />
);
