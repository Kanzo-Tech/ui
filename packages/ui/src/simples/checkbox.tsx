import {
  Checkbox as ArkCheckbox,
  useCheckboxContext,
} from "@ark-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import type React from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn";

export const useCheckbox = useCheckboxContext;

export const CheckboxGroup = (
  props: React.ComponentProps<typeof ArkCheckbox.Group>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCheckbox.Group
      className={cn("flex flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "checkbox-group"}
    />
  );
};

export const checkboxVariants = tv({
  base: [
    "relative",
    "inline-flex shrink-0 items-center justify-center",
    "size-4",
    "bg-transparent",
    "rounded-sm border border-input shadow-xs/5",
    "transition-shadow",
    "data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring data-focus-visible:ring-offset-1 data-focus-visible:ring-offset-background",
    "dark:data-focus-visible:data-invalid:border-destructive-foreground/64 dark:data-focus-visible:data-invalid:ring-destructive-foreground/48",
    "data-disabled:opacity-64",
    "[[data-disabled],[data-checked],[data-invalid]]:shadow-none",
    "data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:data-invalid:text-destructive-foreground",
    "dark:not-data-checked:bg-field",
    "motion-reduce:transition-none!",
  ],
});

export const Checkbox = (
  props: React.ComponentProps<typeof ArkCheckbox.Root>
) => {
  const { className, tabIndex, slot, ...rest } = props;

  return (
    <ArkCheckbox.Root
      className={cn(checkboxVariants(), className)}
      role="checkbox"
      {...rest}
      data-slot={slot ?? "checkbox"}
    >
      <ArkCheckbox.Control data-slot="checkbox-control">
        <CheckboxIndicator>
          <CheckIcon />
        </CheckboxIndicator>

        <CheckboxIndicator indeterminate>
          <MinusIcon />
        </CheckboxIndicator>
      </ArkCheckbox.Control>

      <ArkCheckbox.HiddenInput tabIndex={tabIndex} />
    </ArkCheckbox.Root>
  );
};

export const CheckboxIndicator = (
  props: React.ComponentProps<typeof ArkCheckbox.Indicator>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCheckbox.Indicator
      className={cn(
        "absolute -inset-px",
        "flex items-center justify-center",
        "rounded-sm",
        "text-primary-foreground",
        "data-[state=checked]:bg-primary",
        "data-[state=unchecked]:hidden",
        "data-[state=indeterminate]:text-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "checkbox-indicator"}
    />
  );
};
