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
    "bg-transparent",
    "rounded-selector border border-input shadow-xs/5",
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

/**
 * Two defects this component carried for as long as it existed, both found by a composite trying to
 * use it and both measured before the fix.
 *
 * The box styling sat on the **root**, so the root was the box and there was nowhere for a label to
 * go: `children` arrived through `...rest` above hardcoded JSX children, JSX children win, and
 * `<Checkbox>Sealed orders</Checkbox>` rendered `textContent: ""`. Four docs examples are written
 * that way, the default one included, so the Checkbox page shipped unlabelled boxes
 * (`decisions/a-docs-defect-is-a-library-defect.md`). `RadioGroupItem` one file over already had
 * the right shape — box on the control, root as the row, children beside it — and this now matches
 * it. `checkboxVariants` still names the box; what changed is which element wears it.
 *
 * And `role="checkbox"` sat on that root, which is Ark's `<label>`, while `HiddenInput` renders a
 * real `<input type="checkbox">` underneath. Two elements answered to the role, the outer carrying
 * the name and the inner the focus. Ark declares no role there on purpose: the input is the
 * control, and the label names it through the `htmlFor` Ark already sets.
 */
export const Checkbox = (
  props: React.ComponentProps<typeof ArkCheckbox.Root>
) => {
  const {
    className,
    tabIndex,
    slot,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  } = props;

  return (
    <ArkCheckbox.Root
      className={cn(
        "inline-flex items-center gap-2",
        "data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "checkbox"}
    >
      <ArkCheckbox.Control
        className={checkboxVariants()}
        data-slot="checkbox-control"
      >
        <CheckboxIndicator>
          <CheckIcon />
        </CheckboxIndicator>

        <CheckboxIndicator indeterminate>
          <MinusIcon />
        </CheckboxIndicator>
      </ArkCheckbox.Control>

      {children}

      {/* The name belongs to the control, and the control is this input. Ark's root is a
          `<label htmlFor>`, so visible children name it for free — but an `aria-label` on a
          `<label>` names nothing, which is why the two naming props are forwarded here. */}
      <ArkCheckbox.HiddenInput
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={tabIndex}
      />
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
        "rounded-selector",
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
