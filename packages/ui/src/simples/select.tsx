"use client";

import { Portal } from "@ark-ui/react";
import { ark } from "@ark-ui/react/factory";
import { Select as ArkSelect, useSelectContext } from "@ark-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { inputVariants } from "./input";
import { Separator } from "./separator";

export const Select: ArkSelect.RootComponent = (props) => {
  const { lazyMount = true, unmountOnExit = true, children, ...rest } = props;

  return (
    <ArkSelect.Root
      data-slot="select"
      lazyMount={lazyMount}
      unmountOnExit={unmountOnExit}
      {...rest}
    >
      {children}

      <ArkSelect.HiddenSelect />
    </ArkSelect.Root>
  );
};

// Divergence from Shark, declared: Shark renders `Select.ClearTrigger` *inside*
// `Select.Trigger`, i.e. a <button> inside a <button>. That is invalid HTML (React logs
// `validateDOMNesting`), the inner button is not reliably reachable by keyboard or screen
// reader, and the clear click bubbles into the trigger, so clearing also opened the listbox.
// Ark's anatomy is `Select.Control > Select.Trigger + Select.ClearTrigger` — the clear is a
// SIBLING — so that is what we render. The look is unchanged: the trigger's indicator group
// keeps reserving the room the clear used to occupy inline, and the clear is pulled back over
// that room with a negative inline-start margin (logical, so RTL flips with it).
const selectTriggerVariants = tv({
  slots: {
    trigger: [
      "w-fit",
      "flex items-center gap-2",
      "text-sm",
      "data-placeholder-shown:text-faint",
      "data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-ring",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
    ],
    indicators: "ms-auto flex items-center gap-1 rtl:me-auto",
    // Pulled back over the room `indicators` reserves, so the clear lands exactly where it
    // rendered as a child of the trigger: 3 (trigger padding) + 4 (indicator) + 1 (gap) +
    // 4 (clear) spacing units, plus the trigger's 1px border. The matching positive
    // margin-inline-end cancels the negative one (-12u-1px + 4u + 8u+1px = 0), so the clear
    // still contributes nothing to the control's intrinsic width and a shrink-to-fit parent
    // keeps measuring the trigger alone. `[&_svg]:size-4` restates the icon rule the trigger
    // used to cascade onto this icon from the outside.
    clear: [
      "relative shrink-0",
      "ms-[calc(var(--spacing)*-12-1px)] me-[calc(var(--spacing)*8+1px)]",
      "[&_svg]:size-4",
    ],
  },
  variants: {
    showClear: {
      // The room the clear overlays: its own 4 units plus the group's 1-unit gap. Reserved
      // only while the clear is on screen — Ark hides it with `hidden` when nothing is
      // selected, and inline it then took no room either, so a `w-fit` trigger keeps sizing
      // exactly as it did.
      true: {
        indicators:
          "group-has-[[data-slot=select-clear-trigger]:not([hidden])]/select-control:ps-5",
      },
    },
  },
  defaultVariants: { showClear: false },
});

interface SelectTriggerProps
  extends React.ComponentProps<typeof ArkSelect.Trigger>,
    VariantProps<typeof inputVariants> {
  /**
   * Show clear trigger
   *
   * @default false
   */
  showClear?: boolean;
}

export const SelectTrigger = (props: SelectTriggerProps) => {
  const {
    showClear = false,
    size = "md",
    className,
    children,
    ...rest
  } = props;

  const styles = selectTriggerVariants({ showClear });

  return (
    <ArkSelect.Control
      className="group/select-control relative flex items-center"
      data-slot="select-control"
    >
      <ArkSelect.Trigger
        className={cn(inputVariants({ size }), styles.trigger(), className)}
        data-slot="select-trigger"
        {...rest}
      >
        {children}

        <div className={styles.indicators()}>
          <ArkSelect.Indicator data-slot="select-indicator">
            <ChevronsUpDownIcon />
          </ArkSelect.Indicator>
        </div>
      </ArkSelect.Trigger>

      {showClear && (
        <SelectClearTrigger className={styles.clear()}>
          <XIcon />
        </SelectClearTrigger>
      )}
    </ArkSelect.Control>
  );
};

export const SelectSeparator = (
  props: React.ComponentProps<typeof Separator>
) => {
  const { className, ...rest } = props;

  return (
    <Separator
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      data-slot="select-separator"
      {...rest}
    />
  );
};

export const SelectValue = (
  props: React.ComponentProps<typeof ArkSelect.ValueText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkSelect.ValueText
      className={cn(
        "min-w-0",
        "flex items-center gap-2",
        "truncate text-nowrap",
        className
      )}
      {...rest}
    />
  );
};

export const SelectContent = (
  props: React.ComponentProps<typeof ArkSelect.Content>
) => {
  const { className, ...rest } = props;

  return (
    <Portal>
      <ArkSelect.Positioner data-slot="select-positioner">
        <ArkSelect.Content
          className={cn(
            "z-50",
            "relative",
            "max-h-96 min-w-(--reference-width)",
            "p-1",
            "bg-popover",
            "text-popover-foreground",
            "rounded-xl border shadow-lg/5",
            "origin-(--transform-origin)",
            "outline-none",
            "overflow-y-auto",
            "duration-100",
            "data-[state=open]:animate-in",
            "data-[state=open]:fade-in-0",
            "data-[state=open]:zoom-in-[98%]",
            "data-[placement=bottom]:slide-in-from-top-2",
            "data-[placement=left]:slide-in-from-end-2",
            "data-[placement=right]:slide-in-from-start-2",
            "data-[placement=top]:slide-in-from-bottom-2",
            "motion-reduce:animate-none!",
            className
          )}
          data-slot="select-content"
          {...rest}
        />
      </ArkSelect.Positioner>
    </Portal>
  );
};

interface SelectGroupProps
  extends React.ComponentProps<typeof ArkSelect.ItemGroup> {
  /**
   * The heading of the group
   */
  heading?: string | React.ReactNode;
}

export const SelectGroup = (props: SelectGroupProps) => {
  const { heading, children, ...rest } = props;

  return (
    <ArkSelect.ItemGroup data-slot="select-group" {...rest}>
      {!!heading && <SelectGroupLabel>{heading}</SelectGroupLabel>}

      {children}
    </ArkSelect.ItemGroup>
  );
};

export const SelectGroupLabel = (
  props: React.ComponentProps<typeof ArkSelect.ItemGroupLabel>
) => {
  const { className, ...rest } = props;

  return (
    <ArkSelect.ItemGroupLabel
      className={cn(
        "px-2 py-1.5",
        "font-semibold text-muted-foreground text-xs",
        className
      )}
      data-slot="select-group-label"
      {...rest}
    />
  );
};

export const SelectItem = (
  props: React.ComponentProps<typeof ArkSelect.Item>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkSelect.Item
      className={cn(
        "relative",
        "w-full",
        "py-1.5 ps-2 pe-8",
        "flex items-center gap-2",
        "select-none text-base md:text-sm",
        "rounded-lg",
        "cursor-default",
        "outline-hidden",
        "in-[[data-slot=select-content]:has([data-slot=select-group-label])]:ps-4",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground",
        className
      )}
      data-slot="select-item"
      {...rest}
    >
      <ArkSelect.ItemText
        className="flex w-full flex-1 items-center gap-2"
        data-slot="select-item-text"
      >
        {children}
      </ArkSelect.ItemText>

      <span className="absolute inset-e-2 flex size-4 items-center justify-center">
        <ArkSelect.ItemIndicator data-slot="select-item-indicator">
          <CheckIcon />
        </ArkSelect.ItemIndicator>
      </span>
    </ArkSelect.Item>
  );
};

const SelectClearTrigger = (
  props: React.ComponentProps<typeof ArkSelect.ClearTrigger>
) => {
  const { className, ...rest } = props;

  return (
    <ArkSelect.ClearTrigger
      aria-label="Clear selected value(s)"
      className={cn(
        "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        "transition-opacity",
        "opacity-64",
        "outline-none focus-visible:opacity-100",
        "hover:opacity-100",
        "motion-reduce:transition-none!",
        className
      )}
      data-slot="select-clear-trigger"
      {...rest}
    />
  );
};

export const SelectEmpty = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  const { empty } = useSelectContext();

  if (empty) {
    return (
      <ark.div
        className={cn(
          "px-2 py-1.5",
          "text-center text-muted-foreground text-sm",
          className
        )}
        role="presentation"
        {...rest}
      />
    );
  }

  return null;
};
