import { Field as ArkField } from "@ark-ui/react/field";
import type React from "react";
import { cn } from "../lib/cn";

const textareaBase = [
  "field-sizing-content min-h-16 w-full",
  "flex",
  "px-3 py-2",
  "bg-transparent dark:bg-field",
  "text-base md:text-sm",
  "rounded-lg border border-input shadow-xs/5",
  "placeholder:text-faint",
  "transition-[color,box-shadow]",
  "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
  "aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/24",
  "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
  "dark:aria-invalid:text-destructive-foreground",
  "dark:data-invalid:text-destructive-foreground",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
  "motion-reduce:transition-none!",
];

export interface TextareaProps extends React.ComponentProps<typeof ArkField.Textarea> {}

export const Textarea = (props: TextareaProps) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkField.Textarea
      className={cn(textareaBase, className)}
      {...rest}
      data-slot={slot ?? "textarea"}
    />
  );
};
