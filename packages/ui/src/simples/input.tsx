import { FieldInput } from "@ark-ui/react/field";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export const inputVariants = tv({
  base: [
    "peer",
    "w-full min-w-0",
    "px-3",
    "bg-transparent dark:bg-field",
    "text-base md:text-sm",
    "rounded-lg border border-input shadow-xs/5",
    "placeholder:text-faint",
    "file:inline-flex file:h-7 file:items-center file:border-0",
    "file:font-medium file:text-foreground file:text-sm",
    "transition-[color,box-shadow]",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    "aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/24",
    "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    // The dark branch is TEXT only, and this is the site the other eleven recipes point at.
    // Shark repaints the border and the ring here too; measured across all six compiled documents,
    // `--destructive` reads 4.15:1 against that document's own dark page — over the 3:1 WCAG 1.4.11
    // asks of the visual information identifying a control or its state, so the border and the ring
    // were buying a hue rather than contrast. Text owes AA's 4.5 and 4.15 misses it, so this half
    // stays. `decisions/an-invalid-boundary-needs-no-dark-branch.md`.
    "dark:aria-invalid:text-destructive-foreground",
    "dark:data-invalid:text-destructive-foreground",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
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

export interface InputProps
  extends Omit<React.ComponentProps<typeof FieldInput>, "size">,
    VariantProps<typeof inputVariants> {}

export const Input = (props: InputProps) => {
  const { size = "md", type = "text", className, slot, ...rest } = props;

  return (
    <FieldInput
      className={cn(inputVariants({ size }), className)}
      data-size={size}
      type={type}
      {...rest}
      data-slot={slot ?? "input"}
    />
  );
};
