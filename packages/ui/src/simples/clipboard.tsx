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
  const { className, slot, ...rest } = props;

  return (
    <ArkClipboard.Root
      className={cn("flex flex-col gap-1.5", className)}
      {...rest}
      data-slot={slot ?? "clipboard"}
    />
  );
};

export const ClipboardLabel = (
  { slot, ...rest }: React.ComponentProps<typeof ArkClipboard.Label>
) => (
  <FieldLabel asChild>
    <ArkClipboard.Label {...rest} data-slot={slot ?? "clipboard-label"} />
  </FieldLabel>
);

export const ClipboardControl = (
  props: React.ComponentProps<typeof ArkClipboard.Control>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkClipboard.Control
      className={cn("flex items-center gap-2", className)}
      {...rest}
      data-slot={slot ?? "clipboard-control"}
    />
  );
};

export const ClipboardInput = (
  props: React.ComponentProps<typeof ArkClipboard.Input>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkClipboard.Input
      className={cn(
        inputVariants({ size: "md" }),
        "read-only:cursor-default read-only:text-muted-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "clipboard-input"}
    />
  );
};

export const ClipboardIndicator = (
  props: React.ComponentProps<typeof ArkClipboard.Indicator>
) => {
  const {
    copied = <CheckIcon />,
    children = <CopyIcon />,
    slot,
    ...rest
  } = props;

  return (
    <ArkClipboard.Indicator
      className="flex items-center justify-center"
      copied={copied}
      {...rest}
      data-slot={slot ?? "clipboard-indicator"}
    >
      {children}
    </ArkClipboard.Indicator>
  );
};

export const ClipboardTrigger = (
  props: React.ComponentProps<typeof ArkClipboard.Trigger>
) => {
  const { className, children = <ClipboardIndicator />, slot, ...rest } = props;

  return (
    <ArkClipboard.Trigger
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        className
      )}
      {...rest}
      data-slot={slot ?? "clipboard-trigger"}
    >
      {children}
    </ArkClipboard.Trigger>
  );
};
