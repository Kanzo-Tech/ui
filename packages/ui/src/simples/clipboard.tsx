"use client";

import {
  Clipboard as ArkClipboard,
  useClipboardContext,
} from "@ark-ui/react/clipboard";
import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";
import { FieldLabel } from "./field";
import { inputVariants } from "./input";

export const useClipboard = useClipboardContext;

export const Clipboard = (
  props: React.ComponentProps<typeof ArkClipboard.Root>
) => {
  const { className, ...rest } = props;

  return (
    <ArkClipboard.Root
      className={cn("flex flex-col gap-1.5", className)}
      data-slot="clipboard"
      {...rest}
    />
  );
};

export const ClipboardLabel = (
  props: React.ComponentProps<typeof ArkClipboard.Label>
) => (
  <FieldLabel asChild>
    <ArkClipboard.Label data-slot="clipboard-label" {...props} />
  </FieldLabel>
);

export const ClipboardControl = (
  props: React.ComponentProps<typeof ArkClipboard.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkClipboard.Control
      className={cn("flex items-center gap-2", className)}
      data-slot="clipboard-control"
      {...rest}
    />
  );
};

export const ClipboardInput = (
  props: React.ComponentProps<typeof ArkClipboard.Input>
) => {
  const { className, ...rest } = props;

  return (
    <ArkClipboard.Input
      className={cn(
        inputVariants({ size: "md" }),
        "read-only:cursor-default read-only:text-muted-foreground",
        className
      )}
      data-slot="clipboard-input"
      {...rest}
    />
  );
};

export const ClipboardIndicator = (
  props: React.ComponentProps<typeof ArkClipboard.Indicator>
) => {
  const { copied = <CheckIcon />, children = <CopyIcon />, ...rest } = props;

  return (
    <ArkClipboard.Indicator
      className="flex items-center justify-center"
      copied={copied}
      data-slot="clipboard-indicator"
      {...rest}
    >
      {children}
    </ArkClipboard.Indicator>
  );
};

export const ClipboardTrigger = (
  props: React.ComponentProps<typeof ArkClipboard.Trigger>
) => {
  const { className, children = <ClipboardIndicator />, ...rest } = props;

  return (
    <ArkClipboard.Trigger
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        className
      )}
      data-slot="clipboard-trigger"
      {...rest}
    >
      {children}
    </ArkClipboard.Trigger>
  );
};
