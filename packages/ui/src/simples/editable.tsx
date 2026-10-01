"use client";

import { Editable as ArkEditable, useEditableContext } from "@ark-ui/react/editable";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { type ButtonProps, buttonVariants } from "./button";

export const useEditable = useEditableContext;

export interface EditableProps extends React.ComponentProps<typeof ArkEditable.Root> {
  /**
   * How `EditableControl` lays out its triggers: in a row, or stacked and aligned to the end.
   *
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

export const Editable = (props: EditableProps) => {
  const { orientation = "horizontal", className, slot, ...rest } = props;

  return (
    <ArkEditable.Root
      className={cn(
        "group/editable",
        "relative",
        "flex w-full min-w-0 items-center gap-2",
        "data-[orientation=vertical]:items-end",
        className,
      )}
      data-orientation={orientation}
      {...rest}
      data-slot={slot ?? "editable"}
    />
  );
};

export const EditableArea = (props: React.ComponentProps<typeof ArkEditable.Area>) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkEditable.Area
      className={cn("w-full min-w-0", className)}
      {...rest}
      data-slot={slot ?? "editable-area"}
    />
  );
};

export interface EditableInputProps
  extends Omit<React.ComponentProps<typeof ArkEditable.Input>, "size"> {}

export const EditableInput = ({ slot, ...rest }: EditableInputProps) => (
  <ArkEditable.Input {...rest} data-slot={slot ?? "editable-input"} />
);

export interface EditablePreviewProps extends React.ComponentProps<typeof ArkEditable.Preview> {
  /**
   * The height of the control the preview stands in for — match it to the `Input` it swaps with.
   *
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "xl";
  /** @default "outline" */
  variant?: ButtonProps["variant"];
}

/** True while `node`'s text is cut off by its own box. */
function useOverflowing(node: React.RefObject<HTMLElement | null>, text: string) {
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [node, text]);

  return overflowing;
}

/**
 * The value at rest. Over an `Input` it is one line, ellipsised, carrying the full value as its
 * `title` once it no longer fits; over a `Textarea` it wraps and grows.
 */
export const EditablePreview = (props: EditablePreviewProps) => {
  const { variant = "outline", size = "md", className, slot, asChild, children, title, ...rest } =
    props;
  const editable = useEditableContext();
  const text = useRef<HTMLSpanElement>(null);
  const overflowing = useOverflowing(text, editable.valueText);

  return (
    <ArkEditable.Preview
      asChild={asChild}
      className={cn(
        buttonVariants({ variant, size, clickEffect: false }),
        "w-full min-w-0 shrink justify-start",
        "font-normal text-base sm:text-sm",
        "data-placeholder-shown:text-muted-foreground",
        "in-[[data-slot=editable-area]:has(textarea)]:h-auto",
        "in-[[data-slot=editable-area]:has(textarea)]:items-start",
        "in-[[data-slot=editable-area]:has(textarea)]:whitespace-pre-wrap",
        className,
      )}
      data-size={size}
      title={title ?? (overflowing && !editable.empty ? editable.value : undefined)}
      {...rest}
      data-slot={slot ?? "editable-preview"}
    >
      {asChild ? (
        children
      ) : (
        <span
          className="min-w-0 overflow-hidden text-ellipsis"
          data-slot="editable-preview-text"
          ref={text}
        >
          {children ?? editable.valueText}
        </span>
      )}
    </ArkEditable.Preview>
  );
};

export const EditableControl = (props: React.ComponentProps<typeof ArkEditable.Control>) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkEditable.Control
      className={cn(
        "inline-flex shrink-0 items-center gap-2",
        "group-data-[orientation=vertical]/editable:flex-col",
        className,
      )}
      {...rest}
      data-slot={slot ?? "editable-control"}
    />
  );
};

export const EditableEditTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkEditable.EditTrigger>,
) => <ArkEditable.EditTrigger {...rest} data-slot={slot ?? "editable-edit-trigger"} />;

export const EditableCancelTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkEditable.CancelTrigger>,
) => <ArkEditable.CancelTrigger {...rest} data-slot={slot ?? "editable-cancel-trigger"} />;

export const EditableSubmitTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof ArkEditable.SubmitTrigger>,
) => <ArkEditable.SubmitTrigger {...rest} data-slot={slot ?? "editable-submit-trigger"} />;
