"use client";

import {
  Accordion as ArkAccordion,
  useAccordionContext,
} from "@ark-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";

export const useAccordion = useAccordionContext;

export const Accordion = (
  props: React.ComponentProps<typeof ArkAccordion.Root>
) => {
  const { className, ...rest } = props;

  return (
    <ArkAccordion.Root
      className={cn("group/accordion", className)}
      data-slot="accordion"
      {...rest}
    />
  );
};

export const AccordionItem = (
  props: React.ComponentProps<typeof ArkAccordion.Item>
) => {
  const { className, ...rest } = props;

  return (
    <ArkAccordion.Item
      className={cn("border-b last:border-b-0", className)}
      data-slot="accordion-item"
      {...rest}
    />
  );
};

export const AccordionItemTrigger = (
  props: React.ComponentProps<typeof ArkAccordion.ItemTrigger>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkAccordion.ItemTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4",
        "py-4 text-start font-medium text-sm",
        "cursor-pointer transition-all hover:underline",
        "rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      data-slot="accordion-item-trigger"
      {...rest}
    >
      {children}
      <ArkAccordion.ItemIndicator
        className="data-[state=open]:[&_svg]:rotate-180"
        data-slot="accordion-item-indicator"
      >
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none!" />
      </ArkAccordion.ItemIndicator>
    </ArkAccordion.ItemTrigger>
  );
};

export const AccordionItemContent = (
  props: React.ComponentProps<typeof ArkAccordion.ItemContent>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkAccordion.ItemContent
      className={cn(
        "overflow-hidden",
        "transition-[height] duration-200",
        "data-[state=open]:animate-expand",
        "data-[state=closed]:animate-collapse",
        "motion-reduce:animate-none! motion-reduce:transition-none!"
      )}
      data-slot="accordion-item-content"
      {...rest}
    >
      <div className={cn("pb-4 text-muted-foreground text-sm", className)}>
        {children}
      </div>
    </ArkAccordion.ItemContent>
  );
};
