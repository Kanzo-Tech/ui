"use client";

import { ark } from "@ark-ui/react/factory";
import { RefreshCcwIcon, SendIcon, SquareIcon } from "lucide-react";
import type React from "react";
import { tv } from "tailwind-variants";
import {
  cn,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Spinner,
} from "@kanzo-tech/ui";
import type { AiStatus } from "./use-ai.js";

/**
 * The composer: the library's `InputGroup` as a form, so Enter and the button are one path.
 *
 * `asChild` rather than a wrapping `<form>`: `InputGroup`'s recipe selects its own direct children
 * (`has-[>textarea]`, `has-[>[data-align=block-end]]`), and an element between the group and the
 * field silently unsets half of it.
 */
export const PromptInput = (props: React.ComponentProps<typeof ark.form>) => {
  const { className, slot, ...rest } = props;

  return (
    // A composer is a panel rather than a one-line control, so it takes the next radius up and a
    // shadow that puts it on top of the page instead of flush with it.
    <InputGroup asChild className={cn("rounded-xl shadow-xs/5", className)}>
      <ark.form {...rest} data-slot={slot ?? "prompt-input"} />
    </InputGroup>
  );
};

export const PromptInputTextarea = (props: React.ComponentProps<typeof InputGroupTextarea>) => {
  const { className, onKeyDown, rows = 1, slot, ...rest } = props;

  return (
    <InputGroupTextarea
      // `Textarea`'s base already sets `field-sizing-content`, so the field grows with what is
      // typed; the ceiling is what this adds. Without it a pasted document swallows the panel and
      // takes the transcript with it. Past 12rem the field scrolls and the composer stops moving.
      className={cn("max-h-48 min-h-16", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        // `isComposing` is the trap: an IME commits its candidate with Enter, and without this the
        // half-typed word is sent instead of finished.
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }}
      rows={rows}
      {...rest}
      slot={slot ?? "prompt-input-textarea"}
    />
  );
};

/**
 * The strip of controls under the field — a model picker, an attachment, the ✨, the submit.
 *
 * `align="block-end"` is not decoration: a popover trigger living here anchors to the composer, so
 * its surface opens over the text it writes. Hung off a label row above the field instead, it
 * opened against the panel's edge, far from the value. Nothing here may become `overflow-hidden`
 * for the same reason.
 *
 * It wraps rather than overflows, because everything in it is `shrink-0`: four controls in a narrow
 * panel pushed the submit past the composer's edge instead of taking a second line.
 */
export const PromptInputToolbar = (props: React.ComponentProps<typeof InputGroupAddon>) => {
  const { className, slot, ...rest } = props;

  return (
    <InputGroupAddon
      align="block-end"
      className={cn("min-w-0 flex-wrap gap-1", className)}
      // The addon's own handler focuses an `input`, and a composer has a `textarea` — so the strip
      // carried `cursor-text` and gave no caret. Same guard: a press on a control is that control's.
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
        event.currentTarget.parentElement?.querySelector("textarea")?.focus();
      }}
      {...rest}
      slot={slot ?? "prompt-input-toolbar"}
    />
  );
};

const SEND = { icon: <SendIcon />, label: "Send" };

const SUBMIT: Record<AiStatus, { icon: React.ReactNode; label: string }> = {
  idle: SEND,
  // An answer that has arrived leaves the composer ready for the next question, so `ready` and
  // `idle` are one button. They are two states of the *stream*, not two states of this control.
  ready: SEND,
  loading: {
    // The stop block inside the spinner it is stopping. A bare square changes only the glyph, and
    // at a glance across a panel that reads as the same idle button; the motion is what says the
    // answer is still arriving. `aria-hidden` on both — the accessible name already changed to
    // "Stop", and a `role="status"` inside a named button announces the state twice.
    icon: (
      <span className="relative flex size-4 items-center justify-center">
        <Spinner aria-hidden className="absolute size-4" />
        <SquareIcon aria-hidden className="size-2.5" />
      </span>
    ),
    label: "Stop",
  },
  error: { icon: <RefreshCcwIcon />, label: "Retry" },
};

/**
 * One control in three looks, so the fill is what carries the state and the box never moves: same
 * slot, same size, same corner in all of them. `idle`, `ready` and `loading` share `Button`'s
 * `default` variant outright — the glyph is the whole difference — and `error` takes the wash
 * `Alert` uses for the same family, which is a button you can still press, not a disabled one.
 */
const promptInputSubmitVariants = tv({
  // No transition of its own: `Button`'s base already carries `transition-all` and the
  // `motion-reduce` escape, and a narrower `transition-colors` here would replace both.
  base: ["ms-auto"],
  variants: {
    status: {
      idle: "",
      ready: "",
      loading: "",
      error: [
        "bg-destructive/7 hover:bg-destructive/14",
        "border-destructive/30",
        "text-destructive-foreground",
        "shadow-none",
      ],
    },
  },
  defaultVariants: {
    status: "idle",
  },
});

export interface PromptInputSubmitProps
  extends React.ComponentProps<typeof InputGroupButton> {
  status?: AiStatus;
}

export const PromptInputSubmit = (props: PromptInputSubmitProps) => {
  const {
    status = "idle",
    className,
    children,
    type = "submit",
    variant = "default",
    size = children === undefined ? "icon-sm" : "sm",
    slot,
    ...rest
  } = props;
  const { icon, label } = SUBMIT[status];

  return (
    <InputGroupButton
      // Only where the button has no visible text of its own: a label over a legible one renames
      // it, which is worse than not having one.
      aria-label={children === undefined ? label : undefined}
      className={cn(promptInputSubmitVariants({ status }), className)}
      data-status={status}
      size={size}
      type={type}
      variant={variant}
      {...rest}
      slot={slot ?? "prompt-input-submit"}
    >
      {children ?? icon}
    </InputGroupButton>
  );
};
