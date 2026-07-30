import { NumberInput as ArkNumberInput } from "@ark-ui/react/number-input";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

// The Control is the input shell (border, focus ring, invalid, disabled) — Ark ships no `Group`
// part, so the shell lives here and the stepper triggers float at the inline-end edge.
const numberInputControlVariants = tv({
  base: [
    "group/number-input",
    "relative flex w-full min-w-0 items-stretch",
    "bg-transparent dark:bg-field",
    "rounded-lg border border-input shadow-xs/5",
    "transition-[color,box-shadow]",
    "outline-none focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring",
    "data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:data-invalid:border-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "motion-reduce:transition-none!",
  ],
  variants: {
    size: {
      sm: "h-7",
      md: "h-8",
      lg: "h-9",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const numberInputTriggerVariants = tv({
  base: [
    "absolute end-0",
    "flex h-1/2 w-6 items-center justify-center",
    "border-input border-s",
    "text-muted-foreground",
    "transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
    "motion-reduce:transition-none!",
  ],
});

export const NumberInput = (
  props: React.ComponentProps<typeof ArkNumberInput.Root>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkNumberInput.Root
      className={cn("flex w-full flex-col items-start gap-2", className)}
      {...rest}
      data-slot={slot ?? "number-input"}
    />
  );
};

export const NumberInputLabel = (
  props: React.ComponentProps<typeof ArkNumberInput.Label>
) => {
  const { children, slot, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkNumberInput.Label {...rest} data-slot={slot ?? "number-input-label"}>
        {children}
      </ArkNumberInput.Label>
    </FieldLabel>
  );
};

export interface NumberInputControlProps
  extends Omit<React.ComponentProps<typeof ArkNumberInput.Control>, "size">,
    VariantProps<typeof numberInputControlVariants> {}

export const NumberInputControl = (props: NumberInputControlProps) => {
  const { size = "md", className, slot, ...rest } = props;

  return (
    <ArkNumberInput.Control
      className={cn(numberInputControlVariants({ size }), className)}
      {...rest}
      data-slot={slot ?? "number-input-control"}
    />
  );
};

export const NumberInputInput = (
  props: React.ComponentProps<typeof ArkNumberInput.Input>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkNumberInput.Input
      className={cn(
        "w-full min-w-0",
        "ps-3 pe-8",
        "bg-transparent",
        "text-base tabular-nums md:text-sm",
        "rounded-[inherit]",
        "placeholder:text-faint",
        "outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        className
      )}
      {...rest}
      data-slot={slot ?? "number-input-input"}
    />
  );
};

export const NumberInputIncrementTrigger = (
  props: React.ComponentProps<typeof ArkNumberInput.IncrementTrigger>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkNumberInput.IncrementTrigger
      className={cn(
        numberInputTriggerVariants(),
        "top-0 rounded-se-lg border-b",
        className
      )}
      {...rest}
      data-slot={slot ?? "number-input-increment-trigger"}
    >
      {children ?? <ChevronUpIcon />}
    </ArkNumberInput.IncrementTrigger>
  );
};

export const NumberInputDecrementTrigger = (
  props: React.ComponentProps<typeof ArkNumberInput.DecrementTrigger>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkNumberInput.DecrementTrigger
      className={cn(numberInputTriggerVariants(), "bottom-0 rounded-ee-lg", className)}
      {...rest}
      data-slot={slot ?? "number-input-decrement-trigger"}
    >
      {children ?? <ChevronDownIcon />}
    </ArkNumberInput.DecrementTrigger>
  );
};

// A drag-to-change surface — wrap it around the label (or an icon) and the pointer scrubs the
// value. `cursor-ew-resize` is the only affordance it carries.
export const NumberInputScrubber = (
  props: React.ComponentProps<typeof ArkNumberInput.Scrubber>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkNumberInput.Scrubber
      className={cn("cursor-ew-resize select-none", className)}
      {...rest}
      data-slot={slot ?? "number-input-scrubber"}
    />
  );
};

export const NumberInputValueText = (
  props: React.ComponentProps<typeof ArkNumberInput.ValueText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkNumberInput.ValueText
      className={cn("tabular-nums", className)}
      {...rest}
      data-slot={slot ?? "number-input-value-text"}
    />
  );
};
