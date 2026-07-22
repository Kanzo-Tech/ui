import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Link — a token-styled anchor. `variant` picks the treatment; for router links, spread
 * onto a framework link via the product's `linkComponent` seam or `asChild`-style
 * composition. (Generic layout stays in the product via Tailwind — the DS ships no
 * `Flex`/`Box`/`Grid`.)
 */
export const linkRecipe = tv({
  base: "rounded-sm underline-offset-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
  variants: {
    variant: {
      default: "text-primary hover:underline",
      subtle: "text-muted-foreground hover:text-foreground hover:underline",
      plain: "text-inherit no-underline hover:underline",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface LinkProps extends React.ComponentProps<"a">, VariantProps<typeof linkRecipe> {}

export function Link({ variant, className, ref, ...rest }: LinkProps) {
  return <a ref={ref} data-slot="link" className={cn(linkRecipe({ variant }), className)} {...rest} />;
}
Link.displayName = "Link";
