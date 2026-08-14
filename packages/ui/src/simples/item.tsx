// The row counterpart to Card: a horizontal media · content · actions strip, for lists of
// records where a Card would be too heavy. Presentational (`ark.*`), no client boundary.

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Separator } from "./separator";

export const ItemGroup = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("group/item-group flex w-full flex-col gap-4", className)}
      role="list"
      {...rest}
      data-slot={slot ?? "item-group"}
    />
  );
};

export const ItemSeparator = (props: React.ComponentProps<typeof Separator>) => {
  const { className, slot, ...rest } = props;

  return (
    <Separator
      className={cn("my-2", className)}
      orientation="horizontal"
      {...rest}
      slot={slot ?? "item-separator"}
    />
  );
};

const itemVariants = tv({
  base: [
    "[--space:--spacing(3)]",
    "group/item",
    "flex w-full flex-wrap items-center",
    "gap-(--space) p-(--space)",
    "in-data-[slot=menu-content]:p-0",
    "rounded-xl border text-sm",
    "transition-colors duration-100",
    "[a]:transition-colors [a]:hover:bg-muted",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  variants: {
    variant: {
      default: "border-transparent",
      outline: "border-border shadow-xs/5",
      muted: "border-transparent bg-muted/48 shadow-muted/5 shadow-xs",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ItemProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof itemVariants> {}

/**
 * One row. A `<div>` carrying `role="listitem"`, which is what `ItemGroup`'s `role="list"` requires
 * of its children.
 *
 * **Do not `asChild` this onto an interactive element.** Ark clones the parent's props onto the
 * child through zag's `mergeProps`, and there the child only wins where the child *declares* a
 * value — a `<button>` declares no `role`, so `role="listitem"` lands on it and replaces the
 * implicit `button`. The control keeps working and stops being announced as a control, which is the
 * kind of defect nothing in the pipeline reports.
 *
 * A pressable row is a button **inside** the item, not merged with it. `p-0` on the item and the
 * padding on the button keeps the whole row as the target, which is what makes 2.5.8 easy here.
 * `asChild` is still right for a non-interactive swap — an `<li>`, an `<article>`.
 */
export const Item = (props: ItemProps) => {
  const { variant = "default", className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(itemVariants({ variant }), className)}
      data-variant={variant}
      role="listitem"
      {...rest}
      data-slot={slot ?? "item"}
    />
  );
};

const itemMediaVariants = tv({
  base: [
    "flex shrink-0 items-center justify-center gap-2",
    "group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start",
    "[&_svg]:pointer-events-none",
  ],
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image: "size-10 overflow-hidden rounded-xl [&_img]:size-full [&_img]:object-cover",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ItemMediaProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof itemMediaVariants> {}

export const ItemMedia = (props: ItemMediaProps) => {
  const { variant = "default", className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(itemMediaVariants({ variant }), className)}
      data-variant={variant}
      {...rest}
      data-slot={slot ?? "item-media"}
    />
  );
};

// A full-width row above the main line (breaks to its own line via `basis-full`).
export const ItemHeader = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        "[&_img]:size-full [&_img]:rounded-xl [&_img]:object-cover",
        className
      )}
      {...rest}
      data-slot={slot ?? "item-header"}
    />
  );
};

export const ItemContent = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5",
        "[&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "item-content"}
    />
  );
};

// No `line-clamp-1` here, deliberately: it sets `display: -webkit-box`, which cannot coexist
// with the `flex` this row needs, so tailwind-merge kept one and silently dropped `flex` — and
// with it the `gap-2` between a title's children. Truncation is opt-in at the call site.
export const ItemTitle = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex w-fit items-center gap-2",
        "font-medium text-sm leading-snug",
        "underline-offset-4",
        className
      )}
      {...rest}
      data-slot={slot ?? "item-title"}
    />
  );
};

export const ItemDescription = (props: React.ComponentProps<typeof ark.p>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.p
      className={cn(
        "line-clamp-2 text-start font-normal text-muted-foreground text-sm leading-normal",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...rest}
      data-slot={slot ?? "item-description"}
    />
  );
};

export const ItemActions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("flex items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "item-actions"}
    />
  );
};

// A full-width row below the main line.
export const ItemFooter = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...rest}
      data-slot={slot ?? "item-footer"}
    />
  );
};
