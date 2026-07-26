"use client";

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";

interface TableProps extends React.ComponentProps<typeof ark.table> {
  /**
   * Whether the table rows are hoverable.
   *
   * @default true
   */
  isHoverable?: boolean;
  /**
   * The variant of the table.
   *
   * @default "plain"
   */
  variant?: "plain" | "striped";
  /**
   * Pin the header row while the rows scroll under it.
   *
   * This has to change the wrapper, not just the cells: `position: sticky` resolves against the
   * nearest scroll container, and the wrapper's `overflow-auto` is one — so a sticky `th` pins to
   * a box exactly as tall as its own content, which never moves. WHICH scroll container it should
   * pin to is what `maxHeight` decides, and the two answers behave differently enough to choose
   * between deliberately.
   *
   * The pinned cells need to be opaque or the rows read through them; `bg-background` assumes the
   * table sits on the page surface, so on a `Card` pass `className="bg-card"` to `TableHead`.
   *
   * @default false
   */
  stickyHeader?: boolean;
  /**
   * Give the table its own scroll region, and pin the header to that.
   *
   * With it, the wrapper stays a scroll container and simply gains a height: the header pins to
   * the table's own scrollport and a table wider than its box still scrolls sideways. Without it,
   * `stickyHeader` stands the wrapper's overflow down so the header pins to whatever encloses the
   * table — a `ShellMain`, a dialog body, the page — which reads better, one scrollbar instead of
   * two, but gives up that sideways scroll: CSS cannot keep one axis scrollable while the other
   * stays sticky. Set it whenever the columns may not fit, which on a narrow viewport is most
   * tables.
   */
  maxHeight?: string | number;
}

export const Table = (props: TableProps) => {
  const {
    variant = "plain",
    isHoverable = true,
    stickyHeader = false,
    maxHeight,
    className,
    ...rest
  } = props;

  /** Only a header pinned to the ENCLOSING region needs the wrapper to stop scrolling. */
  const regionScrolled = stickyHeader && maxHeight === undefined;

  return (
    <div
      className={cn("relative w-full", regionScrolled ? "overflow-visible" : "overflow-auto")}
      data-slot="table-wrapper"
      style={maxHeight === undefined ? undefined : { maxHeight }}
    >
      <ark.table
        className={cn(
          "group/table",
          "w-full",
          "caption-bottom",
          "text-foreground text-sm",
          "data-[sticky-header=true]:[&_thead_th]:sticky",
          "data-[sticky-header=true]:[&_thead_th]:top-0",
          "data-[sticky-header=true]:[&_thead_th]:z-10",
          "data-[sticky-header=true]:[&_thead_th]:bg-background",
          // `top: 0` pins to the scrollport's CONTENT edge, so a scroll region with padding leaves
          // a band above the header where the rows scroll past in plain sight. The header cannot
          // know that padding, so it covers it: an opaque strip standing on the cell's top edge,
          // clipped by the bordered box and therefore invisible at rest, since the header is the
          // first thing that box contains.
          "data-[sticky-header=true]:[&_thead_th]:before:absolute",
          "data-[sticky-header=true]:[&_thead_th]:before:inset-x-0",
          "data-[sticky-header=true]:[&_thead_th]:before:bottom-full",
          "data-[sticky-header=true]:[&_thead_th]:before:h-24",
          "data-[sticky-header=true]:[&_thead_th]:before:bg-background",
          className
        )}
        data-hoverable={isHoverable}
        data-slot="table"
        data-sticky-header={stickyHeader}
        data-variant={variant}
        {...rest}
      />
    </div>
  );
};

export const TableHeader = (props: React.ComponentProps<typeof ark.thead>) => {
  const { className, ...rest } = props;

  return (
    <ark.thead
      className={cn("[&_tr]:border-b", className)}
      data-slot="table-header"
      {...rest}
    />
  );
};

export interface TableBodyProps
  extends React.ComponentProps<typeof ark.tbody> {}

export const TableBody = (props: TableBodyProps) => {
  const { className, ...rest } = props;

  return (
    <ark.tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...rest}
    />
  );
};

export const TableFooter = (props: React.ComponentProps<typeof ark.tfoot>) => {
  const { className, ...rest } = props;

  return (
    <ark.tfoot
      className={cn(
        "border-t",
        "bg-muted/48",
        "font-medium",
        "last:[&>tr]:border-b-0",
        className
      )}
      data-slot="table-footer"
      {...rest}
    />
  );
};

export const TableRow = (props: React.ComponentProps<typeof ark.tr>) => {
  const { className, ...rest } = props;

  return (
    <ark.tr
      className={cn(
        "border-b",
        "data-[state=selected]:bg-muted",
        "group-data-[variant=striped]/table:even:bg-muted/30",
        "group-data-[hoverable=true]/table:[&:has(td):hover]:bg-muted/48",
        className
      )}
      data-slot="table-row"
      {...rest}
    />
  );
};

export const TableHead = (props: React.ComponentProps<typeof ark.th>) => {
  const { className, ...rest } = props;

  return (
    <ark.th
      className={cn(
        "h-10 px-2",
        "text-left align-middle",
        "font-medium text-muted-foreground",
        "rtl:text-right",
        "has-[[role=checkbox]]:ps-2 has-[[role=checkbox]]:pe-0",
        className
      )}
      data-slot="table-head"
      {...rest}
    />
  );
};

export const TableCell = (props: React.ComponentProps<typeof ark.td>) => {
  const { className, ...rest } = props;

  return (
    <ark.td
      className={cn(
        "whitespace-nowrap p-2 align-middle",
        "has-[[role=checkbox]]:ps-2 has-[[role=checkbox]]:pe-0",
        className
      )}
      data-slot="table-cell"
      {...rest}
    />
  );
};

export const TableCaption = (
  props: React.ComponentProps<typeof ark.caption>
) => {
  const { className, ...rest } = props;

  return (
    <ark.caption
      className={cn("mt-4", "text-muted-foreground text-sm", className)}
      data-slot="table-caption"
      {...rest}
    />
  );
};
