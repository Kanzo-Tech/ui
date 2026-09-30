import { ark } from "@ark-ui/react/factory";
import type { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

// The zero state of a region: shadcn v4's `Empty` anatomy, under Ark's part vocabulary. Ark ships
// no empty-state machine, so every part is presentational and carries no role — it is not a list
// item, and it was being built from `Item`, whose `role="listitem"` said it was.

/** Fills the region it sits in and centres what it holds, on both axes. */
export function EmptyRoot({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        className,
      )}
      {...rest}
      data-slot={slot ?? "empty"}
    />
  );
}
EmptyRoot.displayName = "EmptyRoot";

/** Indicator, title and description as one block: a tighter gap than the root's, and a reading
 *  measure. Without it the root's `gap-6` would fall between the title and its own sentence. */
export function EmptyHeader({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
      {...rest}
      data-slot={slot ?? "empty-header"}
    />
  );
}
EmptyHeader.displayName = "EmptyHeader";

const emptyIndicatorVariants = tv({
  base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "size-10 rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface EmptyIndicatorProps
  extends ComponentProps<typeof ark.div>,
    VariantProps<typeof emptyIndicatorVariants> {}

/** The icon or image above the title. `icon` sets the glyph on a muted tile; `default` leaves an
 *  avatar or an illustration as it is. */
export function EmptyIndicator({ variant = "default", className, slot, ...rest }: EmptyIndicatorProps) {
  return (
    <ark.div
      className={cn(emptyIndicatorVariants({ variant }), className)}
      data-variant={variant}
      {...rest}
      data-slot={slot ?? "empty-indicator"}
    />
  );
}
EmptyIndicator.displayName = "EmptyIndicator";

/** A `div` by default: only the call site knows the outline, so a heading is `asChild` onto one. */
export function EmptyTitle({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("font-medium text-lg tracking-tight", className)}
      {...rest}
      data-slot={slot ?? "empty-title"}
    />
  );
}
EmptyTitle.displayName = "EmptyTitle";

export function EmptyDescription({ className, slot, ...rest }: ComponentProps<typeof ark.p>) {
  return (
    <ark.p
      className={cn(
        "text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      {...rest}
      data-slot={slot ?? "empty-description"}
    />
  );
}
EmptyDescription.displayName = "EmptyDescription";

/** What the reader can do about it — actions, a link, a search field. */
export function EmptyContent({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className,
      )}
      {...rest}
      data-slot={slot ?? "empty-content"}
    />
  );
}
EmptyContent.displayName = "EmptyContent";
