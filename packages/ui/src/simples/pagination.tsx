"use client";

import {
  Pagination as ArkPagination,
  usePaginationContext,
} from "@ark-ui/react/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export const usePagination = usePaginationContext;

export const Pagination = (
  props: React.ComponentProps<typeof ArkPagination.Root>
) => {
  const { className, ...rest } = props;

  return (
    <ArkPagination.Root
      aria-label="Pagination"
      className={cn("flex items-center gap-1", className)}
      data-slot="pagination"
      {...rest}
    />
  );
};

export const PaginationPrevTrigger = (
  props: React.ComponentProps<typeof ArkPagination.PrevTrigger>
) => (
  <ArkPagination.PrevTrigger
    asChild
    data-slot="pagination-prev-trigger"
    {...props}
  >
    <Button aria-label="Previous page" size="icon-md" variant="ghost">
      <ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkPagination.PrevTrigger>
);

export const PaginationNextTrigger = (
  props: React.ComponentProps<typeof ArkPagination.NextTrigger>
) => (
  <ArkPagination.NextTrigger
    asChild
    data-slot="pagination-next-trigger"
    {...props}
  >
    <Button aria-label="Next page" size="icon-md" variant="ghost">
      <ChevronRightIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkPagination.NextTrigger>
);

export interface PaginationItemProps
  extends React.ComponentProps<typeof ArkPagination.Item> {}

export const PaginationItem = (props: PaginationItemProps) => {
  const { className, children, ...rest } = props;

  // The current page carries `data-selected` (and `aria-current="page"`) from
  // the machine, so it reads as filled/secondary while the rest stay ghost.
  return (
    <ArkPagination.Item asChild data-slot="pagination-item" {...rest}>
      <Button
        className={cn(
          "tabular-nums",
          "data-selected:bg-secondary data-selected:text-secondary-foreground data-selected:shadow-none",
          className
        )}
        size="icon-md"
        variant="ghost"
      >
        {children}
      </Button>
    </ArkPagination.Item>
  );
};

export const PaginationEllipsis = (
  props: React.ComponentProps<typeof ArkPagination.Ellipsis>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkPagination.Ellipsis
      className={cn(
        "flex size-8 shrink-0 items-center justify-center",
        "text-muted-foreground text-sm",
        className
      )}
      data-slot="pagination-ellipsis"
      {...rest}
    >
      {children ?? (
        <>
          <span aria-hidden>&#8230;</span>
          <span className="sr-only">More pages</span>
        </>
      )}
    </ArkPagination.Ellipsis>
  );
};
