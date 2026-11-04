"use client";

import {
  Pagination as ArkPagination,
  usePaginationContext,
} from "@ark-ui/react/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type React from "react";
import { createContext, useContext } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export const usePagination = usePaginationContext;

/** Ark's own `translations`, and the ellipsis's, which Ark does not label. */
export interface PaginationTranslations
  extends NonNullable<React.ComponentProps<typeof ArkPagination.Root>["translations"]> {
  ellipsisLabel?: string;
}

// Capitalised, where Ark's are not. The triggers draw no label of their own, so these reach them.
const ENGLISH = {
  rootLabel: "Pagination",
  prevTriggerLabel: "Previous page",
  nextTriggerLabel: "Next page",
  ellipsisLabel: "More pages",
};

const EllipsisLabel = createContext(ENGLISH.ellipsisLabel);

export interface PaginationProps extends React.ComponentProps<typeof ArkPagination.Root> {
  translations?: PaginationTranslations;
}

export const Pagination = (props: PaginationProps) => {
  const { className, slot, translations, ...rest } = props;
  const t = { ...ENGLISH, ...translations };

  return (
    <EllipsisLabel.Provider value={t.ellipsisLabel}>
      <ArkPagination.Root
        className={cn("flex items-center gap-1", className)}
        {...rest}
        translations={t}
        data-slot={slot ?? "pagination"}
      />
    </EllipsisLabel.Provider>
  );
};

export const PaginationPrevTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkPagination.PrevTrigger>
) => (
  <ArkPagination.PrevTrigger asChild {...rest}>
    <Button
      size="icon-md"
      slot={slot ?? "pagination-prev-trigger"}
      variant="ghost"
    >
      <ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkPagination.PrevTrigger>
);

export const PaginationNextTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkPagination.NextTrigger>
) => (
  <ArkPagination.NextTrigger asChild {...rest}>
    <Button
      size="icon-md"
      slot={slot ?? "pagination-next-trigger"}
      variant="ghost"
    >
      <ChevronRightIcon aria-hidden className="rtl:rotate-180" />
    </Button>
  </ArkPagination.NextTrigger>
);

export interface PaginationItemProps
  extends React.ComponentProps<typeof ArkPagination.Item> {}

export const PaginationItem = (props: PaginationItemProps) => {
  const { className, children, slot, ...rest } = props;

  // The current page carries `data-selected` (and `aria-current="page"`) from
  // the machine, so it reads as filled/secondary while the rest stay ghost.
  return (
    <ArkPagination.Item asChild {...rest}>
      <Button
        className={cn(
          "tabular-nums",
          "data-selected:bg-secondary data-selected:text-secondary-foreground data-selected:shadow-none",
          className
        )}
        size="icon-md"
        slot={slot ?? "pagination-item"}
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
  const { className, children, slot, ...rest } = props;
  const label = useContext(EllipsisLabel);

  return (
    <ArkPagination.Ellipsis
      className={cn(
        "flex size-8 shrink-0 items-center justify-center",
        "text-muted-foreground text-sm",
        className
      )}
      {...rest}
      data-slot={slot ?? "pagination-ellipsis"}
    >
      {children ?? (
        <>
          <span aria-hidden>&#8230;</span>
          <span className="sr-only">{label}</span>
        </>
      )}
    </ArkPagination.Ellipsis>
  );
};
