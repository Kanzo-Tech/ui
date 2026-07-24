// A cluster of related actions rendered as one visual unit — the buttons/inputs are children,
// this only groups them. Presentational (`ark.*`), so no client boundary. For a SINGLE-select
// choice use `SegmentGroup`; this is for independent actions sitting shoulder to shoulder.

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Separator } from "./separator";

export const buttonGroupVariants = tv({
  base: [
    "flex items-center",
    "isolate",
    // Children overlap by a pixel so shared borders don't double, and the focused/hovered one
    // lifts above its neighbours so its ring is never clipped.
    "[&>*]:relative",
    "[&>*:hover]:z-1 [&>*:focus-visible]:z-1",
    "data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
    // Horizontal: collapse the inner radii, overlap along the inline axis.
    "data-[orientation=horizontal]:[&>*:not(:first-child)]:rounded-s-none",
    "data-[orientation=horizontal]:[&>*:not(:last-child)]:rounded-e-none",
    "data-[orientation=horizontal]:[&>*:not(:first-child)]:-ms-px",
    // Vertical: collapse along the block axis instead.
    "data-[orientation=vertical]:[&>*:not(:first-child)]:rounded-t-none",
    "data-[orientation=vertical]:[&>*:not(:last-child)]:rounded-b-none",
    "data-[orientation=vertical]:[&>*:not(:first-child)]:-mt-px",
  ],
});

// A group of independent actions is not a labelled region on its own, so it needs an accessible
// name the way a `<fieldset>` would — but a real fieldset/legend fights `aria-label`. So we take
// `role="group"` and REQUIRE a name at the type level: exactly one of `aria-label` /
// `aria-labelledby` must be supplied.
type Labelled =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export type ButtonGroupProps = Omit<
  React.ComponentProps<typeof ark.div>,
  "aria-label" | "aria-labelledby"
> & {
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
} & Labelled;

export const ButtonGroup = (props: ButtonGroupProps) => {
  const { orientation = "horizontal", className, ...rest } = props;

  return (
    <ark.div
      className={cn(buttonGroupVariants(), className)}
      data-orientation={orientation}
      data-slot="button-group"
      role="group"
      {...rest}
    />
  );
};

// A text label sitting inside the cluster (a unit, a prefix). Mirrors `InputGroupText`.
export const ButtonGroupText = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, ...rest } = props;

  return (
    <ark.span
      className={cn(
        "flex items-center gap-2",
        "px-3",
        "select-none font-medium text-muted-foreground text-sm",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      data-slot="button-group-text"
      {...rest}
    />
  );
};

// Divides two sub-clusters inside a group. Vertical by default — a button group runs along the
// inline axis, so the divider between two runs is a vertical hairline.
export const ButtonGroupSeparator = (
  props: React.ComponentProps<typeof Separator>
) => {
  const { orientation = "vertical", className, ...rest } = props;

  return (
    <Separator
      className={cn("self-stretch", className)}
      data-slot="button-group-separator"
      orientation={orientation}
      {...rest}
    />
  );
};
