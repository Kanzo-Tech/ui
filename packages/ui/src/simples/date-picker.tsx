import {
  DatePicker as ArkDatePicker,
  useDatePickerContext,
} from "@ark-ui/react/date-picker";
import { Portal } from "@ark-ui/react/portal";
import { CalendarIcon, ClockIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
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

export const DatePicker = (props: React.ComponentProps<typeof Calendar>) => {
  const { positioning = { placement: "top" }, slot, ...rest } = props;

  return (
    <Calendar
      inline={false}
      positioning={positioning}
      {...rest}
      slot={slot ?? "date-picker"}
    />
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
          {/* One size for the chain, and it used to declare two: the outer `InputGroupButton` asked
              for `icon-sm` and the inner `Button` — which exists only because Ark's Trigger needs a
              child to hand its props to — overrode it with `icon-md`. The outer one is the size a
              control inside a group has, so the inner declares none. */}
          <InputGroupButton asChild size="icon-sm" variant="ghost">
            <ArkDatePicker.Trigger asChild>
              <Button slot="date-picker-trigger" variant="ghost">
                <CalendarIcon aria-hidden className="text-muted-foreground" />
              </Button>
            </ArkDatePicker.Trigger>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </ArkDatePicker.Control>
  );
};

export const DatePickerTimer = (props: React.ComponentProps<typeof Input>) => {
  const { id, value, defaultValue, className, ...rest } = props;

  return (
    <InputGroup {...rest}>
      <InputGroupAddon>
        <ClockIcon />
      </InputGroupAddon>
      <InputGroupInput
        className={cn(
          "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
          className
        )}
        defaultValue={defaultValue}
        id={id}
        step="1"
        type="time"
        value={value}
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
