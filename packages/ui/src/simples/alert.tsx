"use client";

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

const alertVariants = tv({
  base: [
    "relative",
    "px-3.5 py-3",
    "grid w-full items-start gap-x-2 gap-y-0.5",
    "text-card-foreground text-sm",
    "rounded-xl border",
    "has-[>svg]:has-data-[slot=alert-action]:grid-cols-[--spacing(4)_1fr_auto] has-[>svg]:grid-cols-[--spacing(4)_1fr]",
    "has-[>svg]:gap-x-2 [&_svg]:h-lh [&_svg]:w-4",
    "has-data-[slot=alert-action]:grid-cols-[1fr_auto]",
  ],
  variants: {
    variant: {
      default: [
        // A quiet surface on an unknown backdrop, which is what a wash is for. It was
        // `bg-field`, and a field now recedes to the page — correct for a control identified by
        // `border-input`, wrong for a panel whose whole job is to sit visibly on top of one.
        "bg-secondary-wash",
        "[&_svg]:text-muted-foreground",
        "[&_[data-slot=alert-action]_[data-variant=ghost]]:hover:bg-muted",
      ],
      destructive: [
        "bg-destructive-wash",
        "border-destructive-border",
        "[&_svg]:text-destructive",
        "[&_[data-slot=alert-action]_[data-variant=ghost]]:hover:bg-destructive-wash-strong",
      ],
      info: [
        "bg-info-wash",
        "border-info-border",
        "[&_svg]:text-info",
        "[&_[data-slot=alert-action]_[data-variant=ghost]]:hover:bg-info-wash-strong",
      ],
      warning: [
        "bg-warning-wash",
        "border-warning-border",
        "[&_svg]:text-warning",
        "[&_[data-slot=alert-action]_[data-variant=ghost]]:hover:bg-warning-wash-strong",
      ],
      success: [
        "bg-success-wash",
        "border-success-border",
        "[&_svg]:text-success",
        "[&_[data-slot=alert-action]_[data-variant=ghost]]:hover:bg-success-wash-strong",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface AlertProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof alertVariants> {}

export const Alert = (props: AlertProps) => {
  const { variant, className, ...rest } = props;

  return (
    <ark.div
      // Announce to assistive tech: destructive is urgent (assertive), the rest are polite.
      // `role` sits before `...rest` so a consumer can still override it.
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      {...rest}
    />
  );
};

export const AlertTitle = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "font-heading font-medium",
        "[svg~&]:col-start-2",
        className
      )}
      data-slot="alert-title"
      {...rest}
    />
  );
};

export const AlertDescription = (
  props: React.ComponentProps<typeof ark.div>
) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex flex-col gap-2.5",
        "text-muted-foreground",
        "[svg~&]:col-start-2",
        className
      )}
      data-slot="alert-description"
      {...rest}
    />
  );
};

export const AlertAction = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex gap-1",
        "max-sm:col-start-2 max-sm:mt-2",
        "sm:[svg~[data-slot=alert-title]~&]:col-start-3",
        "sm:row-start-1 sm:row-end-3 sm:self-center",
        "sm:[[data-slot=alert-description]~&]:col-start-2",
        "sm:[[data-slot=alert-title]~&]:col-start-2",
        "sm:[svg~&]:col-start-2",
        "sm:[svg~[data-slot=alert-description]~&]:col-start-3",
        className
      )}
      data-slot="alert-action"
      {...rest}
    />
  );
};
