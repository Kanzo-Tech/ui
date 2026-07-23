"use client";

import {
  RadioGroup as ArkRadioGroup,
  useRadioGroupContext,
} from "@ark-ui/react/radio-group";
import type React from "react";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

export const useRadioGroup = useRadioGroupContext;

export const RadioGroup = (
  props: React.ComponentProps<typeof ArkRadioGroup.Root>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkRadioGroup.Root
      className={cn(
        "flex flex-col gap-3",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      data-slot="radio-group"
      {...rest}
    >
      {children}
    </ArkRadioGroup.Root>
  );
};

export const RadioGroupItem = (
  props: React.ComponentProps<typeof ArkRadioGroup.Item>
) => {
  const { tabIndex, className, children, ...rest } = props;

  return (
    <ArkRadioGroup.Item
      className={cn(
        "inline-flex items-center gap-2",
        "data-disabled:opacity-64",
        className
      )}
      data-slot="radio-group-item"
      {...rest}
    >
      <ArkRadioGroup.ItemControl
        className={cn(
          "relative",
          "inline-flex shrink-0 items-center justify-center",
          "size-4",
          "border border-input shadow-xs/5",
          "bg-input/30",
          "rounded-full",
          "before:size-1.5 before:rounded-full",
          "data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring/32 data-focus-visible:ring-offset-1 data-focus-visible:ring-offset-background",
          "data-focus-visible:data-invalid:border-destructive/64 data-focus-visible:data-invalid:ring-destructive/48",
          "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
          "dark:data-invalid:border-destructive-foreground dark:data-invalid:text-destructive dark:data-invalid:ring-[3px] dark:data-invalid:ring-destructive-foreground/20",
          "data-[state=checked]:bg-primary data-[state=checked]:before:bg-primary-foreground",
          "data-invalid:data-[state=checked]:bg-transparent data-invalid:data-[state=checked]:before:bg-destructive-foreground"
        )}
        data-slot="radio-group-item-control"
      />

      <RadioGroupText>{children}</RadioGroupText>

      <ArkRadioGroup.ItemHiddenInput tabIndex={tabIndex} />
    </ArkRadioGroup.Item>
  );
};

// A card-shaped option: raw children (compose label/description/preview/indicator yourself),
// full radio semantics from Ark, the selected look driven by `data-[state=checked]`. This is
// what "card radio" is — the same machine styled as a card, not a separate component.
export const RadioGroupCard = (
  props: React.ComponentProps<typeof ArkRadioGroup.Item>
) => {
  const { tabIndex, className, children, ...rest } = props;

  return (
    <ArkRadioGroup.Item
      className={cn(
        "relative flex cursor-pointer gap-2 rounded-lg border border-input bg-transparent p-3 transition-colors",
        "hover:bg-accent/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-accent",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "has-data-focus-visible:border-primary has-data-focus-visible:ring-[3px] has-data-focus-visible:ring-ring/32",
        "data-invalid:border-destructive",
        className
      )}
      data-slot="radio-group-card"
      {...rest}
    >
      {children}
      <ArkRadioGroup.ItemHiddenInput tabIndex={tabIndex} />
    </ArkRadioGroup.Item>
  );
};

// The visual radio dot, no semantics of its own — drop it inside a card to show selection.
export const RadioGroupIndicator = (
  props: React.ComponentProps<typeof ArkRadioGroup.ItemControl>
) => {
  const { className, ...rest } = props;

  return (
    <ArkRadioGroup.ItemControl
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-input/30 shadow-xs/5",
        "before:size-1.5 before:rounded-full",
        "data-[state=checked]:bg-primary data-[state=checked]:before:bg-primary-foreground",
        className
      )}
      data-slot="radio-group-indicator"
      {...rest}
    />
  );
};

export const RadioGroupText = (
  props: React.ComponentProps<typeof ArkRadioGroup.ItemText>
) => {
  const { className, children, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkRadioGroup.ItemText data-slot="radio-group-item-text" {...rest}>
        {children}
      </ArkRadioGroup.ItemText>
    </FieldLabel>
  );
};

export const RadioGroupLabel = (
  props: React.ComponentProps<typeof ArkRadioGroup.Label>
) => {
  const { children, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkRadioGroup.Label data-slot="radio-group-label" {...rest}>
        {children}
      </ArkRadioGroup.Label>
    </FieldLabel>
  );
};
