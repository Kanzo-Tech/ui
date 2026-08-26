"use client";

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";

/**
 * A row of values on offer. **It does not know where they came from.**
 *
 * That is the whole reason it is here and not in `@kanzo-tech/ai`: the line that package draws is
 * *does the component know a model exists*, and a strip of buttons that each commit a string does
 * not. Recent searches, saved filters, a questionnaire's quick answers and a model's candidates are
 * one component; the ✨ beside it is what says a model wrote these, and that stays next door.
 *
 * **Not a listbox, and this is the correction it exists to make.** Picking one leaves an *effect* —
 * a value in a field — not a selection in a list, which makes it a command surface rather than a
 * value surface. The version this replaces was an Ark listbox whose
 * `value` was pinned to a hoisted empty array forever, with a comment explaining why; that comment
 * was the rule being noticed and worked around instead of read.
 *
 * ARIA: nothing is declared. Each pill is a `<button>` with its own accessible name, in document
 * order, so Tab reaches every one and a screen reader announces them as what they are. A
 * `role="listbox"` here would promise a navigation model that is not implemented — the failure a
 * composite role without its keyboard contract always is.
 *
 * Wraps by default. A caller that wants one scrolling line passes `flex-nowrap overflow-x-auto`.
 */
export const Suggestions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      {...rest}
      data-slot={slot ?? "suggestions"}
    />
  );
};

export interface SuggestionProps extends Omit<ButtonProps, "onSelect" | "value"> {
  /** What this pill commits. Also its identity — a strip never offers one value twice. */
  value: string;
  /** Given the value, so a handler needs no closure per pill. */
  onSelect?: (value: string) => void;
}

/**
 * One value on offer, as a pill.
 *
 * `onSelect` takes the value rather than the event, which is what lets a caller write one handler
 * for the whole strip. `onClick` still fires first and still wins: calling `preventDefault` on it
 * stops the select, so a pill can be intercepted without being rebuilt.
 *
 * Children default to the value. Give it children when the label and the value differ — the value
 * is what gets committed either way.
 */
export const Suggestion = (props: SuggestionProps) => {
  const { children, className, onClick, onSelect, size = "sm", slot, value, variant = "outline", ...rest } =
    props;

  return (
    <Button
      className={cn("h-auto max-w-full py-1", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.(value);
      }}
      pill
      size={size}
      variant={variant}
      {...rest}
      slot={slot ?? "suggestion"}
    >
      {children ?? value}
    </Button>
  );
};
