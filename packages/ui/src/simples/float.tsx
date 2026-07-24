// Float positions its child over a corner or edge of the nearest positioned ancestor. It is
// pure box model, so it needs no client boundary — but it DOES need a `position: relative`
// (or any non-static) parent to anchor against; without one it escapes to the viewport.

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

export const floatVariants = tv({
  base: ["absolute z-10", "flex items-center justify-center"],
  variants: {
    // Vertical uses `middle-*` (not `center-*`); horizontal uses `*-center`. The nine cells of
    // a 3×3 grid, addressed with logical inset props so they mirror under RTL.
    placement: {
      "top-start": "top-0 start-0",
      "top-center": "top-0 start-1/2 -translate-x-1/2",
      "top-end": "top-0 end-0",
      "middle-start": "top-1/2 start-0 -translate-y-1/2",
      "middle-center": "top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2",
      "middle-end": "top-1/2 end-0 -translate-y-1/2",
      "bottom-start": "bottom-0 start-0",
      "bottom-center": "bottom-0 start-1/2 -translate-x-1/2",
      "bottom-end": "bottom-0 end-0",
    },
  },
  defaultVariants: {
    placement: "top-end",
  },
});

export interface FloatProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof floatVariants> {}

export const Float = (props: FloatProps) => {
  const { placement = "top-end", className, ...rest } = props;

  return (
    <ark.div
      className={cn(floatVariants({ placement }), className)}
      data-placement={placement}
      data-slot="float"
      {...rest}
    />
  );
};
