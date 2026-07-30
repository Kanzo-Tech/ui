import { Editable as ArkEditable } from "@ark-ui/react/editable";
import type React from "react";
import { cn } from "../lib/cn";
import { type ButtonProps, buttonVariants } from "./button";

export interface EditableProps extends React.ComponentProps<typeof ArkEditable.Root> {
  orientation?: "horizontal" | "vertical";
}

export const Editable = (props: EditableProps) => {
  const { orientation = "horizontal", className, slot, ...rest } = props;

  return (
    <ArkEditable.Root
      className={cn(
        "group/editable",
        "relative",
        "w-full",
        "data-[orientation=vertical]:items-end",
        "flex items-center gap-2",
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
    <ArkEditable.Area className={cn("w-full", className)} {...rest} data-slot={slot ?? "editable-area"} />
  );
};

export interface EditableInputProps
  extends Omit<React.ComponentProps<typeof ArkEditable.Input>, "size"> {}

export const EditableInput = ({ slot, ...rest }: EditableInputProps) => (
  <ArkEditable.Input {...rest} data-slot={slot ?? "editable-input"} />
);

interface EditablePreviewProps extends React.ComponentProps<typeof ArkEditable.Preview> {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

export const EditablePreview = (props: EditablePreviewProps) => {
  const { variant = "outline", size = "md", className, slot, ...rest } = props;

  return (
    <ArkEditable.Preview
      className={cn(
        buttonVariants({ variant, size, clickEffect: false }),
        "w-full justify-start",
        "px-3",
        "whitespace-pre-wrap font-normal text-base sm:text-sm",
        "data-placeholder-shown:text-muted-foreground",
        "in-[[data-slot=editable-area]:has(textarea)]:items-start",
        className,
      )}
      {...rest}
      data-slot={slot ?? "editable-preview"}
    />
  );
};

export const EditableControl = (props: React.ComponentProps<typeof ArkEditable.Control>) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkEditable.Control
      className={cn(
        "group-data-[orientation=vertical]/editable:flex-col",
        "inline-flex items-center gap-2",
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
