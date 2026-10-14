import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";

/**
 * Eyebrow — the small uppercase line that names a block from above it: *Parameters* over a tool's
 * input, *Theme* over a picker, *How it fits together* over a list. The typographer's word for it,
 * and the one that does not collide with Tailwind's `overline`, which is a text decoration.
 *
 * A look and nothing else, so the element is the caller's: it renders a `<div>` and takes
 * `asChild`, because what the line IS depends on what it heads — a `<legend>` over a group, a
 * `<label>` over one control, `SliderLabel` over a slider, an `<h3>` where it is a heading. The
 * child's own `data-slot` survives the merge, so `<Eyebrow asChild><FieldLegend /></Eyebrow>` is
 * still a field legend to every selector that reads one.
 *
 * It carries no margin and no size override: the space under it is the placement's, and the IDE
 * tier's 11px (`Preferences`) is that call site's `className`, not a second look.
 */
export const Eyebrow = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;
  return (
    <ark.div
      className={cn("font-medium text-muted-foreground text-xs uppercase tracking-wide", className)}
      {...rest}
      data-slot={slot ?? "eyebrow"}
    />
  );
};
