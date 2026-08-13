import { PinInput as ArkPinInput } from "@ark-ui/react/pin-input";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

const pinInputInputVariants = tv({
  base: [
    "shrink-0",
    "text-center tabular-nums",
    "bg-transparent dark:bg-field",
    "text-base md:text-sm",
    "rounded-lg border border-input shadow-xs/5",
    "placeholder:text-faint",
    "transition-[color,box-shadow]",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:data-invalid:text-destructive-foreground",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
    "motion-reduce:transition-none!",
  ],
  variants: {
    size: {
      sm: ["size-7"],
      md: ["size-8"],
      lg: ["size-9"],
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export const PinInput = (
  props: React.ComponentProps<typeof ArkPinInput.Root>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkPinInput.Root
      className={cn("flex flex-col items-start gap-2", className)}
      {...rest}
      data-slot={slot ?? "pin-input"}
    />
  );
};

export const PinInputLabel = (
  props: React.ComponentProps<typeof ArkPinInput.Label>
) => {
  const { children, slot, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkPinInput.Label {...rest} data-slot={slot ?? "pin-input-label"}>
        {children}
      </ArkPinInput.Label>
    </FieldLabel>
  );
};

export const PinInputControl = (
  props: React.ComponentProps<typeof ArkPinInput.Control>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkPinInput.Control
      className={cn("flex items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "pin-input-control"}
    />
  );
};

export interface PinInputInputProps
  extends Omit<React.ComponentProps<typeof ArkPinInput.Input>, "size">,
    VariantProps<typeof pinInputInputVariants> {}

export const PinInputInput = (props: PinInputInputProps) => {
  const { size = "md", className, slot, ...rest } = props;

  return (
    <ArkPinInput.Input
      className={cn(pinInputInputVariants({ size }), className)}
      {...rest}
      data-slot={slot ?? "pin-input-input"}
    />
  );
};
