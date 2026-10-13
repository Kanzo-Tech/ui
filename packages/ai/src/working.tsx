import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn, Spinner } from "@kanzo-tech/ui";

/**
 * Work under way, said: a spinner and the words for what is being done — *Thinking…*, *Reading your
 * files… 4 of 6*. What `Chat` draws where an answer will be, and what a guided chat draws while a
 * step runs. A bar, when there is a measure, is `@kanzo-tech/ui`'s `Progress` beside it.
 *
 * **A spinner, not AI Elements' `Shimmer`.** Their busy words are a gradient swept across the glyphs
 * on a `motion/react` loop — a second vocabulary for *busy*, costing an animation library, beside the
 * one this library already speaks: every busy surface here spins. AI Elements' own `Loader` has since
 * become shadcn's `Spinner`, which is this.
 *
 * ARIA: `role="status"`, so the words are announced when they change, after what the reader is on.
 * The spinner is `aria-hidden` — it is a `role="status"` of its own, and two would announce twice.
 */
export const Working = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, children, slot, ...rest } = props;
  return (
    <ark.div
      className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}
      role="status"
      {...rest}
      data-slot={slot ?? "working"}
    >
      <Spinner aria-hidden className="shrink-0" />
      {children}
    </ark.div>
  );
};
