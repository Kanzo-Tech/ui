import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Text — the brand typography atom (the DS owns the type scale + tone tokens). For
 * *layout* (rows, gaps, spacing) products use Tailwind utilities directly; the DS does
 * not ship generic `Flex`/`Box`/`Grid`. Polymorphic via `as` (defaults to `span`).
 */
export const textRecipe = tv({
  variants: {
    size: { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" },
    weight: { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" },
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      destructive: "text-destructive",
    },
    align: { start: "text-left", center: "text-center", end: "text-right" },
    truncate: { true: "truncate" },
  },
  defaultVariants: { size: "sm", variant: "default" },
});

export interface TextProps extends React.ComponentProps<"span">, VariantProps<typeof textRecipe> {
  /** Element to render — `span` (default), `p`, `div`, `label`, … */
  as?: React.ElementType;
}

export function Text({ as: Tag = "span", size, weight, variant, align, truncate, className, ref, ...rest }: TextProps) {
  return <Tag ref={ref} data-slot="text" className={cn(textRecipe({ size, weight, variant, align, truncate }), className)} {...rest} />;
}
Text.displayName = "Text";
