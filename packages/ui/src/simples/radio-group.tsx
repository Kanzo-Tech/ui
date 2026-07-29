"use client";

import { type UseFieldContext, useFieldContext } from "@ark-ui/react/field";
import {
  RadioGroup as ArkRadioGroup,
  useRadioGroupContext,
} from "@ark-ui/react/radio-group";
import type React from "react";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

export const useRadioGroup = useRadioGroupContext;

export interface RadioGroupProps
  extends React.ComponentProps<typeof ArkRadioGroup.Root> {
  /**
   * Lay the items out as a grid instead of the default column. `"auto"` fits as many
   * card-width tracks as the container allows; a number pins the count.
   *
   * A declared addition to Shark's file, and the whole of what the deleted `CardRadioGroup`
   * added over this compound. Distinct from Ark's `orientation`, which is arrow-key direction
   * and not layout. The count is written to a `--columns` custom property rather than a class,
   * so a responsive count stays CSS and needs no second prop:
   * `columns={1} className="sm:[--columns:2] lg:[--columns:4]"`.
   */
  columns?: number | "auto";
}

// Divergence from Shark, declared: Ark 5.37.2's `useRadioGroup` bridges `useFieldsetContext`
// (disabled/invalid/legend id) but NOT `useFieldContext` — grep `dist/components` and radio-group
// is one of only two form machines with zero `useFieldContext` imports (Slider is the other; the
// thirteen single-control machines all have one). Ark's Field docs only claim "most" components
// support the context and there is no upstream issue, so this reads as an unfilled gap, not a
// decision. Shark neither bridges nor documents it: its docs say "use the `invalid` prop on
// RadioGroup", and its own TanStack example wraps `<Field invalid>` around a RadioGroup that
// never turns red. We bridge it, so `invalid` is stated once on the Field.
//
// State flags only, never `field.ids`: Field addresses ONE control, and a radio group has one
// hidden input per item, so there is no single id for its label to point at — `FieldSet` +
// `FieldLegend` remains the right labelling container. Explicit props still win, and with no
// `Field` ancestor every flag is `undefined`, which Ark strips before it reaches the machine, so
// the built-in Fieldset bridge is untouched.
export const RadioGroup = (props: RadioGroupProps) => {
  const { className, children, columns, style, ...rest } = props;

  const field: UseFieldContext | undefined = useFieldContext();

  return (
    <ArkRadioGroup.Root
      className={cn(
        columns === undefined ? "flex flex-col gap-3" : "grid gap-3",
        columns === "auto" && "grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]",
        typeof columns === "number" &&
          "grid-cols-[repeat(var(--columns),minmax(0,1fr))]",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      data-slot="radio-group"
      disabled={field?.disabled}
      invalid={field?.invalid}
      readOnly={field?.readOnly}
      required={field?.required}
      style={
        typeof columns === "number"
          ? ({ "--columns": columns, ...style } as React.CSSProperties)
          : style
      }
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
          "bg-field",
          "rounded-full",
          "before:size-1.5 before:rounded-full",
          "data-focus-visible:border-primary data-focus-visible:ring-[3px] data-focus-visible:ring-ring data-focus-visible:ring-offset-1 data-focus-visible:ring-offset-background",
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
        // Kept as a dilution, and it is the only one in this package that is. The rest state is the
        // backdrop (`bg-transparent`) and a card can sit anywhere, so no solid is right everywhere:
        // `bg-secondary` is ΔE 0.00 from the rest state on a secondary backdrop, this is ΔE 0.00 on
        // an accent one. The honest answer is an alpha step — `(neutral, a4)` never falls below
        // ΔE 4.32 from the rest state on any surface the theme publishes, against this one's 0.00 —
        // and the theme has no role for it yet (`--field` is a3 and means a control fill). Measured
        // where it works: page/card/popover/muted give ΔE 3.33–6.86 from rest, which clears the
        // ramp's ΔE-2 hover bar, and land on step 4 to within ΔE 1.73 of `--secondary`.
        "hover:bg-accent/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-accent",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "has-data-focus-visible:border-primary has-data-focus-visible:ring-[3px] has-data-focus-visible:ring-ring",
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
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-field shadow-xs/5",
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
