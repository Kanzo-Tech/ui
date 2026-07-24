"use client";

import { FieldInput } from "@ark-ui/react/field";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { useAiFieldOptional } from "./ai-assist";

export const inputVariants = tv({
  base: [
    "peer",
    "w-full min-w-0",
    "px-3",
    "bg-transparent dark:bg-input/30",
    "text-base md:text-sm",
    "rounded-lg border border-input shadow-xs/5",
    "placeholder:text-muted-foreground/64",
    "file:inline-flex file:h-7 file:items-center file:border-0",
    "file:font-medium file:text-foreground file:text-sm",
    "transition-[color,box-shadow]",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32",
    "aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/24",
    "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
    "dark:aria-invalid:border-destructive-foreground dark:aria-invalid:text-destructive-foreground dark:aria-invalid:ring-destructive-foreground/40",
    "dark:data-invalid:border-destructive-foreground dark:data-invalid:text-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
    "motion-reduce:transition-none!",
  ],
  variants: {
    size: {
      sm: ["h-7"],
      md: ["h-8"],
      lg: ["h-9"],
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface InputProps
  extends Omit<React.ComponentProps<typeof FieldInput>, "size">,
    VariantProps<typeof inputVariants> {
  /** Opt into inline ghost completion from a surrounding `<Field complete>` / `<AiAssist>`.
   *  Requires a **controlled** `value`. The ghost is painted by an `aria-hidden` overlay that
   *  mirrors the input's text metrics, shown only when the caret is at the end and the value
   *  fits the box (otherwise the caller's Tab/Esc hint carries it). No-op with no completion in
   *  context. When false/absent, `Input` renders exactly as before. */
  aiComplete?: boolean;
}

export const Input = (props: InputProps) => {
  const { size = "md", type = "text", className, aiComplete, ...rest } = props;
  const ctx = useAiFieldOptional();
  const completion = aiComplete ? (ctx?.completion ?? null) : null;

  if (!completion) {
    return (
      <FieldInput
        className={cn(inputVariants({ size }), className)}
        data-size={size}
        data-slot="input"
        type={type}
        {...rest}
      />
    );
  }

  return (
    <AiInput
      className={className}
      completion={completion}
      pick={ctx?.pick}
      size={size}
      type={type}
      {...rest}
    />
  );
};

type AiInputProps = Omit<InputProps, "aiComplete" | "size"> & {
  size: NonNullable<VariantProps<typeof inputVariants>["size"]>;
  completion: NonNullable<ReturnType<typeof useAiFieldOptional>>["completion"];
  pick?: (value: string) => void;
};

/** The ghost-overlay variant. Split out so the plain `Input` never mounts the extra hooks/DOM. */
function AiInput(props: AiInputProps) {
  const { size, type, className, completion, pick, value, onChange, onKeyDown, ...rest } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const text = typeof value === "string" ? value : "";
  const [atEnd, setAtEnd] = useState(true);
  const [fits, setFits] = useState(true);

  // Show the inline ghost only when the caret sits at the very end and the typed text still fits
  // the box — otherwise the mirror would desync from the input's own horizontal scroll.
  const showGhost = completion!.hasGhost && atEnd && fits;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    setFits(mirror.scrollWidth <= input.clientWidth);
  }, [text]);

  const syncCaret = () => {
    const input = inputRef.current;
    if (!input) return;
    setAtEnd(input.selectionStart === text.length && input.selectionEnd === text.length);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    completion!.setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Tab" && completion!.hasGhost && showGhost) {
      e.preventDefault();
      const insert = completion!.accept();
      const next = text + insert;
      // Re-emit through the caller's onChange with a synthetic-enough event.
      onChange?.({
        ...e,
        target: { ...e.currentTarget, value: next },
        currentTarget: { ...e.currentTarget, value: next },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      pick?.(next);
    } else if (e.key === "Escape" && completion!.hasGhost) {
      completion!.dismiss();
    }
  };

  return (
    <div className="relative w-full min-w-0" data-slot="input-ai">
      <FieldInput
        className={cn(inputVariants({ size }), "relative bg-transparent", className)}
        data-size={size}
        data-slot="input"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        ref={inputRef}
        type={type}
        value={value}
        {...rest}
      />
      {/* aria-hidden overlay mirror: an invisible copy of the value positions the muted ghost
          right after the caret. Same font/padding/border metrics as the input via inputVariants,
          so the two stacks align. Non-interactive; pointer events fall through to the input. */}
      <div
        aria-hidden
        className={cn(
          inputVariants({ size }),
          "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre border-transparent bg-transparent text-transparent shadow-none",
          !showGhost && "invisible",
        )}
      >
        <span className="invisible" ref={mirrorRef}>
          {text}
        </span>
        <span className="text-muted-foreground/64">{completion!.ghost}</span>
      </div>
    </div>
  );
}
