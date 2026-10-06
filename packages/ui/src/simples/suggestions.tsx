"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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
 * Wraps by default, and a pill never outgrows the row: one longer than the strip is as wide as the
 * strip and cut with an ellipsis — see `Suggestion`. A caller that wants one scrolling line passes
 * `flex-nowrap overflow-x-auto`.
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
  /**
   * Why this one is on offer — a saved filter's note, a model's rationale. Shown in the tooltip,
   * which then opens whether or not the label is cut, and read as the pill's accessible
   * description.
   */
  description?: React.ReactNode;
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
 *
 * **A label longer than the strip is cut, never clipped.** `Button` is `whitespace-nowrap`, so a
 * model's sentence in a narrow panel used to run past the panel's edge. The pill is at most the
 * strip's width and its label truncates with an ellipsis; the whole label is in a tooltip, which
 * opens only when the label is cut — a tooltip repeating what the pill already says is noise. The
 * accessible name is the whole label either way: the ellipsis is paint, not text.
 *
 * **A `description` is the one other thing a pill can say**, and it says it in the same tooltip:
 * under the whole label when the label is cut, alone when it is not. It costs no box, so a strip in
 * a side panel stays one row; text under each pill would double it. It is also the accessible
 * description, written once into the page rather than only while the tooltip is open, so a screen
 * reader hears it on focus.
 */
export const Suggestion = (props: SuggestionProps) => {
  const { children, className, description, onClick, onSelect, size = "sm", slot, value, variant = "outline", ...rest } =
    props;
  const label = React.useRef<HTMLSpanElement>(null);
  const described = React.useId();
  const [cut, setCut] = React.useState(false);
  const content = children ?? value;

  // Measured whenever the label's box changes, not when the pointer arrives: a tooltip disabled
  // at the moment it is asked to open stays shut, and one opened and then refused flickers.
  React.useLayoutEffect(() => {
    const element = label.current;
    if (!element) return;
    const measure = () => setCut(element.scrollWidth > element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  return (
    <>
      <Tooltip disabled={!cut && description === undefined}>
        <TooltipTrigger asChild>
          <Button
            aria-describedby={description === undefined ? undefined : described}
            className={cn("h-auto min-w-0 max-w-full py-1", className)}
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
            <span className="min-w-0 truncate" ref={label}>
              {content}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="flex max-w-xs flex-col gap-1">
          {(cut || description === undefined) && <span className="font-medium">{content}</span>}
          {description !== undefined && <span>{description}</span>}
        </TooltipContent>
      </Tooltip>
      {/* Beside the button, not in it: text inside a button is part of its name. */}
      {description !== undefined && (
        <span className="sr-only" id={described}>
          {description}
        </span>
      )}
    </>
  );
};
