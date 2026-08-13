import { ark } from "@ark-ui/react/factory";
import { Field as ArkField } from "@ark-ui/react/field";
import { ChevronsUpDownIcon } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export const nativeSelectVariants = tv({
  base: [
    "appearance-none",
    "w-full min-w-0",
    "ps-2.5 pe-8",
    "select-none text-sm",
    "bg-transparent dark:bg-field",
    "rounded-lg border border-input shadow-xs/5",
    "transition-colors",
    "outline-none",
    "[&:has(option[value='']:checked)]:text-faint",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/24",
    "dark:aria-invalid:text-destructive-foreground",
    "motion-reduce:transition-none!",
  ],
  variants: {
    size: {
      sm: ["h-7"],
      md: ["h-8"],
      lg: ["h-9"],
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface NativeSelectProps
  extends Omit<React.ComponentProps<typeof ArkField.Select>, "size">,
    VariantProps<typeof nativeSelectVariants> {
  /**
   * Whether the select is invalid.
   *
   * @default false
   */
  invalid?: boolean;
}

export const NativeSelect = (props: NativeSelectProps) => {
  const { size = "md", invalid, className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "relative w-fit",
        "has-[select:disabled]:opacity-64",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <ArkField.Select
        aria-invalid={invalid}
        className={cn(nativeSelectVariants({ size }))}
        {...rest}
        data-slot={slot ?? "native-select"}
      />
      <ChevronsUpDownIcon
        aria-hidden="true"
        className={cn("absolute inset-e-2.5 top-1/2 -translate-y-1/2")}
        data-slot="native-select-icon"
      />
    </ark.div>
  );
};

export const NativeSelectOption = (
  { slot, ...rest }: React.ComponentProps<typeof ark.option>
) => <ark.option {...rest} data-slot={slot ?? "native-select-option"} />;

export const NativeSelectOptGroup = (
  { slot, ...rest }: React.ComponentProps<typeof ark.optgroup>
) => <ark.optgroup {...rest} data-slot={slot ?? "native-select-optgroup"} />;
