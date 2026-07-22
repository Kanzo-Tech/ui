"use client";

import { RadioGroup as ArkRadioGroup } from "@ark-ui/react/radio-group";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Badge } from "./badge.js";

export interface CardRadioOption {
  value: string;
  label: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Pre-rendered icon — the design system never picks an icon library for you. */
  icon?: ReactNode;
  /** Free of any coupling to `disabled`: a badge can mark a recommended option too. */
  badge?: ReactNode;
  /** Arbitrary preview node (a type specimen, a swatch, a mini chart). */
  preview?: ReactNode;
  disabled?: boolean;
}

export interface CardRadioGroupProps {
  options: readonly CardRadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fixed column count, or "auto" to fit as many as the width allows. Default "auto". */
  columns?: number | "auto";
  /** Layout inside each card. Default "vertical". */
  orientation?: "vertical" | "horizontal";
  /** Render the radio dot inside the card. Default false — selection reads from the card. */
  showIndicator?: boolean;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  readOnly?: boolean;
  className?: string;
}

/**
 * A radio group whose options are selectable cards.
 *
 * Full radio semantics come from Ark — roving focus, arrow-key selection and the hidden
 * inputs — so the card is purely how the option looks, never how it behaves.
 */
export function CardRadioGroup({
  options,
  value,
  defaultValue,
  onValueChange,
  columns = "auto",
  orientation = "vertical",
  showIndicator = false,
  name,
  disabled,
  invalid,
  readOnly,
  className,
}: CardRadioGroupProps) {
  const vertical = orientation === "vertical";

  return (
    <ArkRadioGroup.Root
      className={cn(
        "grid gap-3",
        columns === "auto"
          ? "grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]"
          : "grid-cols-[repeat(var(--kz-card-radio-cols),minmax(0,1fr))]",
        className
      )}
      data-slot="card-radio-group"
      defaultValue={defaultValue}
      disabled={disabled}
      invalid={invalid}
      name={name}
      onValueChange={(details) => onValueChange?.(details.value ?? "")}
      readOnly={readOnly}
      style={
        columns === "auto"
          ? undefined
          : ({ "--kz-card-radio-cols": columns } as CSSProperties)
      }
      value={value}
    >
      {options.map((option) => (
        <ArkRadioGroup.Item
          className={cn(
            "relative flex gap-2",
            "rounded-lg border border-input bg-transparent p-3",
            "cursor-pointer transition-colors",
            "hover:bg-accent/50",
            "data-[state=checked]:border-primary data-[state=checked]:bg-accent",
            "data-disabled:pointer-events-none data-disabled:opacity-64",
            "has-data-focus-visible:border-primary has-data-focus-visible:ring-[3px] has-data-focus-visible:ring-ring/32",
            "data-invalid:border-destructive",
            vertical
              ? "flex-col items-center justify-center text-center"
              : "flex-row items-start text-start"
          )}
          data-slot="card-radio-item"
          disabled={option.disabled}
          key={option.value}
          value={option.value}
        >
          {option.preview != null && (
            <div className="flex items-center justify-center">
              {option.preview}
            </div>
          )}

          {option.icon != null && (
            <div
              className={cn(
                "shrink-0 text-muted-foreground",
                "[&_svg]:size-5",
                vertical ? undefined : "mt-0.5"
              )}
            >
              {option.icon}
            </div>
          )}

          <div
            className={cn(
              "flex min-w-0 flex-col gap-0.5",
              vertical ? "items-center" : "items-start"
            )}
          >
            <ArkRadioGroup.ItemText
              className="font-medium text-sm leading-tight"
              data-slot="card-radio-item-text"
            >
              {option.label}
            </ArkRadioGroup.ItemText>

            {option.description != null && (
              <span className="text-muted-foreground text-xs leading-snug">
                {option.description}
              </span>
            )}

            {option.badge != null && (
              <Badge className="mt-1" size="xs" variant="outline">
                {option.badge}
              </Badge>
            )}
          </div>

          {showIndicator && (
            <ArkRadioGroup.ItemControl
              className={cn(
                "inline-flex size-4 shrink-0 items-center justify-center",
                "rounded-full border border-input bg-input/30 shadow-xs/5",
                "before:size-1.5 before:rounded-full",
                "data-[state=checked]:bg-primary data-[state=checked]:before:bg-primary-foreground",
                vertical ? "absolute end-2 top-2" : "order-last ms-auto mt-0.5"
              )}
              data-slot="card-radio-item-control"
            />
          )}

          <ArkRadioGroup.ItemHiddenInput />
        </ArkRadioGroup.Item>
      ))}
    </ArkRadioGroup.Root>
  );
}
CardRadioGroup.displayName = "CardRadioGroup";
