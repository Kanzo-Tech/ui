"use client";

import {
  PinInput as ArkPinInput,
  usePinInputContext,
} from "@ark-ui/react/pin-input";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

export const usePinInput = usePinInputContext;

export const pinInputInputVariants = tv({
  base: [
    "shrink-0",
    "text-center tabular-nums",
    "bg-transparent dark:bg-input/30",
    "text-base md:text-sm",
    "rounded-lg border border-input shadow-xs/5",
    "placeholder:text-muted-foreground/64",
    "transition-[color,box-shadow]",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32",
    "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:data-invalid:border-destructive-foreground dark:data-invalid:text-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
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
  const { className, ...rest } = props;

  return (
    <ArkPinInput.Root
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="pin-input"
      {...rest}
    />
  );
};

export const PinInputLabel = (
  props: React.ComponentProps<typeof ArkPinInput.Label>
) => {
  const { children, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkPinInput.Label data-slot="pin-input-label" {...rest}>
        {children}
      </ArkPinInput.Label>
    </FieldLabel>
  );
};

export const PinInputControl = (
  props: React.ComponentProps<typeof ArkPinInput.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkPinInput.Control
      className={cn("flex items-center gap-2", className)}
      data-slot="pin-input-control"
      {...rest}
    />
  );
};

export interface PinInputInputProps
  extends Omit<React.ComponentProps<typeof ArkPinInput.Input>, "size">,
    VariantProps<typeof pinInputInputVariants> {}

export const PinInputInput = (props: PinInputInputProps) => {
  const { size = "md", className, ...rest } = props;

  return (
    <ArkPinInput.Input
      className={cn(pinInputInputVariants({ size }), className)}
      data-slot="pin-input-input"
      {...rest}
    />
  );
};
