import * as React from "react";
import type { InputProps } from "./input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group.js";

/**
 * Kanzo `TextField` — an input with optional edge adornments, composed over Shark's
 * canonical {@link InputGroup} so it inherits the exact input chrome (border, focus
 * ring, `size` scale h-7/8/9, `aria-invalid` styling) instead of a bespoke one that
 * drifts. Consumers speak the design-system vocabulary (`size` + `invalid`) and drop
 * icons / prefixes / actions into the `iconStart` / `iconEnd` slots.
 */

export interface TextFieldProps extends Omit<InputProps, "size"> {
  /** Size, aligned with every other control (h-7 / h-8 / h-9). */
  size?: "sm" | "md" | "lg";
  /** Mark the control invalid — colors border + ring with the danger accent. */
  invalid?: boolean;
  /** Adornment glued to the left edge (icon, prefix). */
  iconStart?: React.ReactNode;
  /** Adornment glued to the right edge (icon, unit, action). */
  iconEnd?: React.ReactNode;
  /** Class for the outer group container (border + size live here). */
  rootClassName?: string;
  /** Slot identifier for the root container (defaults to `text-field`). */
  "data-slot"?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { size = "md", invalid, iconStart, iconEnd, className, rootClassName, disabled, "data-slot": dataSlot = "text-field", ...rest },
  ref,
) {
  return (
    <InputGroup size={size} data-slot={dataSlot} data-disabled={disabled || undefined} className={rootClassName}>
      {iconStart && <InputGroupAddon align="inline-start">{iconStart}</InputGroupAddon>}
      <InputGroupInput
        ref={ref}
        size={size}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={className}
        {...rest}
      />
      {iconEnd && <InputGroupAddon align="inline-end">{iconEnd}</InputGroupAddon>}
    </InputGroup>
  );
});

/**
 * `NumberField` — the numeric-input convenience the products keep re-deriving from
 * `TextField`. Same facade, locked to numeric entry (`type="number"` + decimal
 * `inputMode` for mobile keyboards). Accepts `step` / `min` / `max` like any input.
 */
export type NumberFieldProps = Omit<TextFieldProps, "type">;

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(props, ref) {
  return <TextField ref={ref} type="number" inputMode="decimal" data-slot="number-field" {...props} />;
});
