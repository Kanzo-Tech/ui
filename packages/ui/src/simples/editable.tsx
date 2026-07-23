"use client";

import {
  Editable as ArkEditable,
  useEditableContext,
} from "@ark-ui/react/editable";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";
import { FieldLabel } from "./field";
import { inputVariants } from "./input";

export const useEditable = useEditableContext;

export const EditableContext = ArkEditable.Context;

export const Editable = (props: React.ComponentProps<typeof ArkEditable.Root>) => {
  const { className, ...rest } = props;

  return (
    <ArkEditable.Root
      className={cn("flex flex-col gap-1.5", className)}
      data-slot="editable"
      {...rest}
    />
  );
};

export const EditableLabel = (
  props: React.ComponentProps<typeof ArkEditable.Label>
) => (
  <FieldLabel asChild>
    <ArkEditable.Label data-slot="editable-label" {...props} />
  </FieldLabel>
);

export const EditableArea = (
  props: React.ComponentProps<typeof ArkEditable.Area>
) => {
  const { className, ...rest } = props;

  return (
    <ArkEditable.Area
      className={cn("inline-flex min-w-0", className)}
      data-slot="editable-area"
      {...rest}
    />
  );
};

export const EditableInput = (
  props: React.ComponentProps<typeof ArkEditable.Input>
) => {
  const { className, ...rest } = props;

  return (
    <ArkEditable.Input
      className={cn(inputVariants({ size: "md" }), className)}
      data-slot="editable-input"
      {...rest}
    />
  );
};

export const EditablePreview = (
  props: React.ComponentProps<typeof ArkEditable.Preview>
) => {
  const { className, ...rest } = props;

  return (
    <ArkEditable.Preview
      className={cn(
        "inline-flex h-8 min-w-0 items-center px-3",
        "cursor-text truncate rounded-lg text-base md:text-sm",
        "data-placeholder-shown:text-muted-foreground/64",
        "hover:bg-accent hover:text-accent-foreground",
        className
      )}
      data-slot="editable-preview"
      {...rest}
    />
  );
};

export const EditableControl = (
  props: React.ComponentProps<typeof ArkEditable.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkEditable.Control
      className={cn("flex items-center gap-1.5", className)}
      data-slot="editable-control"
      {...rest}
    />
  );
};

export const EditableEditTrigger = (
  props: React.ComponentProps<typeof ArkEditable.EditTrigger>
) => {
  const { className, children = <PencilIcon />, ...rest } = props;

  return (
    <ArkEditable.EditTrigger
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        className
      )}
      data-slot="editable-edit-trigger"
      {...rest}
    >
      {children}
    </ArkEditable.EditTrigger>
  );
};

export const EditableSubmitTrigger = (
  props: React.ComponentProps<typeof ArkEditable.SubmitTrigger>
) => {
  const { className, children = <CheckIcon />, ...rest } = props;

  return (
    <ArkEditable.SubmitTrigger
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-sm" }),
        className
      )}
      data-slot="editable-submit-trigger"
      {...rest}
    >
      {children}
    </ArkEditable.SubmitTrigger>
  );
};

export const EditableCancelTrigger = (
  props: React.ComponentProps<typeof ArkEditable.CancelTrigger>
) => {
  const { className, children = <XIcon />, ...rest } = props;

  return (
    <ArkEditable.CancelTrigger
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        className
      )}
      data-slot="editable-cancel-trigger"
      {...rest}
    >
      {children}
    </ArkEditable.CancelTrigger>
  );
};
