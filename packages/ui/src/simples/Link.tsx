import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Link — a token-styled anchor, and the only component in the library emitting
 * `data-slot="link"`. `variant` picks the treatment; a router link takes the same treatment by
 * spreading `linkVariants()` onto it. (Generic layout stays in the product via Tailwind — the DS
 * ships no `Flex`/`Box`/`Grid`.)
 *
 * `linkVariants` is module-level and deliberately not on the barrel, which is where every other
 * recipe with no cross-module importer sits: exported, a variant object freezes a class list as
 * API. `index.test.ts` pins that.
 */
export const linkVariants = tv({
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

export interface LinkProps extends React.ComponentProps<"a">, VariantProps<typeof linkVariants> {}

export function Link({ variant, className, ref, ...rest }: LinkProps) {
  return <a ref={ref} data-slot="link" className={cn(linkVariants({ variant }), className)} {...rest} />;
}
Link.displayName = "Link";
