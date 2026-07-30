import { TagsInput as ArkTagsInput } from "@ark-ui/react/tags-input";
import { XIcon } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { FieldLabel } from "./field";

// Render-prop context used to map the machine's value into styled items.
export const TagsInputContext = ArkTagsInput.Context;

export const TagsInput = (
  props: React.ComponentProps<typeof ArkTagsInput.Root>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkTagsInput.Root
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input"}
    >
      {children}
    </ArkTagsInput.Root>
  );
};

export const TagsInputLabel = (
  props: React.ComponentProps<typeof ArkTagsInput.Label>
) => {
  const { children, slot, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkTagsInput.Label {...rest} data-slot={slot ?? "tags-input-label"}>
        {children}
      </ArkTagsInput.Label>
    </FieldLabel>
  );
};

const tagsInputControlVariants = tv({
  base: [
    "group/tags-input-control",
    "relative",
    "w-full min-w-0",
    "flex flex-wrap items-center gap-1.5",
    "bg-background dark:bg-field",
    "rounded-lg border border-input shadow-xs/5",
    "transition-[color,box-shadow]",
    "outline-none",
    "focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring",
    "data-focus:border-primary data-focus:ring-[3px] data-focus:ring-ring",
    "data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:data-invalid:border-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "motion-reduce:transition-none!",
  ],
  variants: {
    size: {
      sm: ["min-h-7", "p-1"],
      md: ["min-h-8", "p-1.5"],
      lg: ["min-h-9", "p-1.5"],
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface TagsInputControlProps
  extends React.ComponentProps<typeof ArkTagsInput.Control>,
    VariantProps<typeof tagsInputControlVariants> {}

export const TagsInputControl = (props: TagsInputControlProps) => {
  const { size = "md", className, slot, ...rest } = props;

  return (
    <ArkTagsInput.Control
      className={cn(tagsInputControlVariants({ size }), className)}
      data-size={size}
      {...rest}
      data-slot={slot ?? "tags-input-control"}
    />
  );
};

export const TagsInputInput = (
  props: React.ComponentProps<typeof ArkTagsInput.Input>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkTagsInput.Input
      className={cn(
        "h-6 flex-1 min-w-16",
        "ps-1.5 pe-1",
        "bg-transparent",
        "text-base md:text-sm",
        "outline-none",
        "placeholder:text-faint",
        "disabled:pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-input"}
    />
  );
};

export const TagsInputItem = (
  props: React.ComponentProps<typeof ArkTagsInput.Item>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkTagsInput.Item
      className={cn(
        "inline-flex items-center",
        "data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-item"}
    />
  );
};

export const TagsInputItemPreview = (
  props: React.ComponentProps<typeof ArkTagsInput.ItemPreview>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkTagsInput.ItemPreview
      className={cn(
        "inline-flex items-center gap-1",
        "h-6",
        "ps-2 pe-1",
        "select-none whitespace-nowrap font-medium text-xs",
        "rounded-md border border-secondary/20",
        "bg-secondary text-secondary-foreground",
        "data-highlighted:border-primary data-highlighted:ring-[3px] data-highlighted:ring-ring",
        "data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-item-preview"}
    />
  );
};

export const TagsInputItemText = (
  props: React.ComponentProps<typeof ArkTagsInput.ItemText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkTagsInput.ItemText
      className={cn("px-0.5", className)}
      {...rest}
      data-slot={slot ?? "tags-input-item-text"}
    />
  );
};

export const TagsInputItemInput = (
  props: React.ComponentProps<typeof ArkTagsInput.ItemInput>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkTagsInput.ItemInput
      className={cn(
        "h-6 min-w-16",
        "px-1",
        "bg-transparent",
        "text-xs",
        "outline-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-item-input"}
    />
  );
};

export const TagsInputItemDeleteTrigger = (
  props: React.ComponentProps<typeof ArkTagsInput.ItemDeleteTrigger>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkTagsInput.ItemDeleteTrigger
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        "size-4",
        "rounded-sm",
        "text-secondary-foreground/64",
        "transition-colors",
        "outline-none",
        "hover:text-secondary-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        "[&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-item-delete-trigger"}
    >
      {children ?? <XIcon aria-hidden />}
    </ArkTagsInput.ItemDeleteTrigger>
  );
};

export const TagsInputClearTrigger = (
  props: React.ComponentProps<typeof ArkTagsInput.ClearTrigger>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkTagsInput.ClearTrigger
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        "size-6",
        "rounded-md",
        "text-muted-foreground",
        "transition-colors",
        "outline-none",
        "hover:text-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "tags-input-clear-trigger"}
    >
      {children ?? <XIcon aria-hidden />}
    </ArkTagsInput.ClearTrigger>
  );
};

export const TagsInputHiddenInput = ({
  slot,
  ...rest
}: React.ComponentProps<typeof ArkTagsInput.HiddenInput>) => (
  <ArkTagsInput.HiddenInput
    {...rest}
    data-slot={slot ?? "tags-input-hidden-input"}
  />
);
