import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export const statusVariants = tv({
  base: [
    "shrink-0 rounded-full",
    "flex items-center justify-center",
    "font-medium text-[10px]",
    "ring-2 ring-background",
  ],
  variants: {
    variant: {
      default: "bg-foreground text-background",
      // `text-*-content`, not `text-white`. The literal was the one sanctioned exception to
      // token-backed utilities, and it was failing AA on every variant — warning at 2.13, success
      // at 2.47 — because with no token there was nothing to measure. The ink is now declared per
      // family by measurement: the fills that hold white keep it, the two that cannot take
      // near-black instead.
      success: "bg-success text-success-content",
      info: "bg-info text-info-content",
      warning: "bg-warning text-warning-content",
      // No `dark:bg-destructive-foreground`, though Shark ships one. It moved the fill and left the
      // ink, so a glyph inside the dot measured 2.35:1 in dark — the `text-white` defect these
      // `-content` tokens exist to kill, reappearing through a `dark:` override. Without it every
      // variant clears AA in both modes; the tightest are this one in light (4.57) and info in dark
      // (4.58). Five variants, one rule, nothing to remember.
      destructive: "bg-destructive text-destructive-content",
    },
    size: {
      sm: "size-2 [&_svg:not([class*='size-'])]:size-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      md: "size-2.5 [&_svg:not([class*='size-'])]:size-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      lg: "size-3 [&_svg:not([class*='size-'])]:size-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

interface StatusProps
  extends React.ComponentProps<typeof ark.span>,
    VariantProps<typeof statusVariants> {}

export const Status = (props: StatusProps) => {
  const { variant, size, className, ...rest } = props;

  return (
    <ark.span
      aria-hidden="true"
      className={cn(statusVariants({ variant, size }), className)}
      data-size={size}
      data-slot="status-indicator"
      {...rest}
    />
  );
};
