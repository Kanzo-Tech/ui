// The row counterpart to Card: a horizontal media · content · actions strip, for lists of
// records where a Card would be too heavy. Presentational (`ark.*`), no client boundary.

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Separator } from "./separator";

export const ItemGroup = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("flex flex-col", className)}
      data-slot="item-group"
      role="list"
      {...rest}
    />
  );
};

export const ItemSeparator = (props: React.ComponentProps<typeof Separator>) => {
  const { className, ...rest } = props;

  return (
    <Separator
      className={cn("my-0", className)}
      data-slot="item-separator"
      {...rest}
    />
  );
};

const itemVariants = tv({
  base: [
    "[--space:--spacing(4)]",
    "group/item relative",
    "flex flex-wrap items-center gap-3",
    "px-(--space) py-3",
    "rounded-lg",
    "text-foreground text-sm",
  ],
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "border",
      muted: "bg-muted/48",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ItemProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof itemVariants> {}

export const Item = (props: ItemProps) => {
  const { variant = "default", className, ...rest } = props;

  return (
    <ark.div
      className={cn(itemVariants({ variant }), className)}
      data-slot="item"
      data-variant={variant}
      role="listitem"
      {...rest}
    />
  );
};

export const ItemMedia = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex shrink-0 items-center justify-center self-start",
        "text-muted-foreground",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      data-slot="item-media"
      {...rest}
    />
  );
};

// A full-width row above the main line (breaks to its own line via `basis-full`).
export const ItemHeader = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      data-slot="item-header"
      {...rest}
    />
  );
};

export const ItemContent = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="item-content"
      {...rest}
    />
  );
};

export const ItemTitle = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("font-medium text-foreground text-sm leading-snug", className)}
      data-slot="item-title"
      {...rest}
    />
  );
};

export const ItemDescription = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="item-description"
      {...rest}
    />
  );
};

export const ItemActions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-2 self-start", className)}
      data-slot="item-actions"
      {...rest}
    />
  );
};

// A full-width row below the main line.
export const ItemFooter = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      data-slot="item-footer"
      {...rest}
    />
  );
};
