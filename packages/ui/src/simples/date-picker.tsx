"use client";

import {
  DatePicker as ArkDatePicker,
  useDatePickerContext,
} from "@ark-ui/react/date-picker";
import { type UseFieldContext, useFieldContext } from "@ark-ui/react/field";
import { Portal } from "@ark-ui/react/portal";
import { CalendarIcon, ClockIcon } from "lucide-react";
import {
  CalendarDate,
  CalendarDateTime,
  type DateValue,
  toCalendarDateTime,
} from "@internationalized/date";
import { createContext, useContext, useRef } from "react";
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

// Provided by `DatePicker` and read by `DatePickerTimer`, which is how the timer knows it is inside
// a picker (and so edits the picker's value) rather than standing alone as a time field. A context
// of ours rather than a probe of Ark's, whose hook throws outside a picker and cannot be asked.
const GranularityContext = createContext<DatePickerGranularity | null>(null);

const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i;
const TIME_24H = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** The input's text for a date-and-time, in the locale's own format. */
function formatTyped(granularity: DatePickerGranularity) {
  return (date: DateValue, details: { locale: string; timeZone: string }) =>
    new Intl.DateTimeFormat(details.locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(granularity === "second" ? { second: "2-digit" } : {}),
      timeZone: details.timeZone,
    }).format(toCalendarDateTime(date).toDate(details.timeZone));
}

/**
 * A date read from what someone typed, in the locale's field order (`14/03/2026`, `3/14/2026`),
 * or year-first when the first number has four digits (`2026-03-14`). `undefined` for anything else,
 * which the machine treats as "not a date yet".
 */
function parseLocalDate(text: string, locale: string): CalendarDate | undefined {
  const numbers = text.match(/\d+/g)?.map(Number);
  if (numbers?.length !== 3) return undefined;
  const first = text.match(/\d+/)?.[0] ?? "";
  const order =
    first.length === 4
      ? ["year", "month", "day"]
      : new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" })
          .formatToParts(new Date(2001, 10, 22))
          .map((part) => part.type)
          .filter((type) => type === "year" || type === "month" || type === "day");
  const at = (type: string) => numbers[order.indexOf(type)] as number;
  const year = at("year");
  const month = at("month");
  const day = at("day");
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new CalendarDate(year < 100 ? 2000 + year : year, month, day);
  return date.day === day ? date : undefined;
}

/** A date and a time read from what someone typed, `14/03/2026, 18:30` or `3/14/2026, 6:30 PM`. */
function parseTyped(
  text: string,
  details: { locale: string },
  kept?: DateValue
): DateValue | undefined {
  const meridiem = TIME.exec(text);
  const time = meridiem ?? TIME_24H.exec(text);
  const date = parseLocalDate(text.replace(time?.[0] ?? "", " "), details.locale);
  if (!date) return undefined;
  // A date typed with no time keeps the time the value had — the machine's own rule when a day is
  // picked in the grid — and midnight when it had none.
  const held = kept && "hour" in kept ? kept : undefined;
  let hour = Number(time?.[1] ?? held?.hour ?? 0);
  if (meridiem) hour = (hour % 12) + (meridiem[4]?.toLowerCase() === "p" ? 12 : 0);
  const minute = Number(time?.[2] ?? held?.minute ?? 0);
  const second = Number(time?.[3] ?? held?.second ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  return new CalendarDateTime(date.year, date.month, date.day, hour, minute, second);
}

export interface DatePickerProps extends React.ComponentProps<typeof Calendar> {
  /**
   * What the picker holds. With `"minute"` or `"second"` the value is a date **and** a time: the
   * input shows both in the locale's format and can be typed into, picking a day keeps the time, a
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
  // What the picker holds, for the parser to keep the time of: the caller's `value`, or the last
  // one an uncontrolled picker reported.
  const reported = useRef<DateValue | undefined>(rest.defaultValue?.[0]);
  const kept = (rest.value ?? [reported.current])[0];

  return (
    <GranularityContext value={granularity}>
      <Calendar
        closeOnSelect={!timed}
        disabled={field?.disabled}
        inline={false}
        invalid={field?.invalid}
        positioning={positioning}
        readOnly={field?.readOnly}
        required={field?.required}
        {...(timed ? { format: formatTyped(granularity), parse: (text, details) => parseTyped(text, details, kept) } : {})}
        {...rest}
        onValueChange={
          timed
            ? (details) => {
                const value = details.value.map((v) => toCalendarDateTime(v));
                reported.current = value[0];
                onValueChange?.({ ...details, value });
              }
            : onValueChange
        }
        slot={slot ?? "date-picker"}
      />
    </GranularityContext>
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

export const DatePickerInput = (props: DatePickerInputProps) => {
  const { size, className, slot, ...rest } = props;

  return (
    <ArkDatePicker.Control data-slot="date-picker-control">
      <InputGroup size={size}>
        <ArkDatePicker.Input asChild {...rest}>
          <InputGroupInput slot={slot ?? "date-picker-input"} />
        </ArkDatePicker.Input>

        <InputGroupAddon align="inline-end">
          <ArkDatePicker.Trigger asChild>
            <InputGroupButton
              size="icon-sm"
              slot="date-picker-trigger"
              variant="ghost"
            >
              <CalendarIcon aria-hidden className="text-muted-foreground" />
            </InputGroupButton>
          </ArkDatePicker.Trigger>
        </InputGroupAddon>
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
  const granularity = useContext(GranularityContext);
  return granularity ? (
    <PickerTimer granularity={granularity} {...props} />
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
