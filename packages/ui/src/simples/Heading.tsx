import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Heading — the brand heading atom (the DS owns the type scale). Polymorphic via `as`
 * (defaults to `h2`); `size` is decoupled from the tag so semantics and appearance
 * stay independent.
 */
export const headingRecipe = tv({
  base: "text-foreground tracking-tight",
  variants: {
    size: { sm: "text-base", md: "text-lg", lg: "text-xl", xl: "text-2xl", "2xl": "text-3xl" },
    weight: { medium: "font-medium", semibold: "font-semibold", bold: "font-bold" },
  },
  defaultVariants: { size: "lg", weight: "semibold" },
});

export interface HeadingProps extends React.ComponentProps<"h2">, VariantProps<typeof headingRecipe> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function Heading({ as: Tag = "h2", size, weight, className, ref, ...rest }: HeadingProps) {
  return <Tag ref={ref} data-slot="heading" className={cn(headingRecipe({ size, weight }), className)} {...rest} />;
}
Heading.displayName = "Heading";
