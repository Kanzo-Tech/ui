"use client";

import { Field as ArkField } from "@ark-ui/react/field";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useAiFieldOptional } from "./ai-assist";

// Shared surface classes — applied to both the real textarea and the aria-hidden ghost mirror,
// so the two stacks wrap and align on identical metrics (font, padding, border, width).
const textareaBase = [
  "field-sizing-content min-h-16 w-full",
  "flex",
  "px-3 py-2",
  "bg-transparent dark:bg-input/30",
  "text-base md:text-sm",
  "rounded-lg border border-input shadow-xs/5",
  "placeholder:text-muted-foreground/64",
  "transition-[color,box-shadow]",
  "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32",
  "aria-invalid:border-destructive aria-invalid:text-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/24",
  "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
  "dark:aria-invalid:border-destructive-foreground dark:aria-invalid:text-destructive-foreground dark:aria-invalid:ring-destructive-foreground/40",
  "dark:data-invalid:border-destructive-foreground dark:data-invalid:text-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
  "motion-reduce:transition-none!",
];

export interface TextareaProps
  extends React.ComponentProps<typeof ArkField.Textarea> {
  /** Opt into inline ghost completion from a surrounding `<Field complete>` / `<AiAssist>`.
   *  Requires a **controlled** `value`. The ghost is painted by an `aria-hidden` mirror that
   *  wraps identically to the textarea (same width/font/padding, `white-space: pre-wrap`),
   *  shown only when the caret is at the end and the value has not scrolled. Otherwise the
   *  caller's Tab/Esc hint carries it. No-op with no completion in context; when false/absent,
   *  `Textarea` renders exactly as before. */
  aiComplete?: boolean;
}

export const Textarea = (props: TextareaProps) => {
  const { className, aiComplete, ...rest } = props;
  const ctx = useAiFieldOptional();
  const completion = aiComplete ? (ctx?.completion ?? null) : null;

  if (!completion) {
    return (
      <ArkField.Textarea
        className={cn(textareaBase, className)}
        data-slot="textarea"
        {...rest}
      />
    );
  }

  return <AiTextarea className={className} completion={completion} pick={ctx?.pick} {...rest} />;
};

type AiTextareaProps = Omit<TextareaProps, "aiComplete"> & {
  completion: NonNullable<ReturnType<typeof useAiFieldOptional>>["completion"];
  pick?: (value: string) => void;
};

/** The ghost-overlay variant. Split out so the plain `Textarea` never mounts the extra hooks/DOM. */
function AiTextarea(props: AiTextareaProps) {
  const { className, completion, pick, value, onChange, onKeyDown, ...rest } = props;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const text = typeof value === "string" ? value : "";
  const [atEnd, setAtEnd] = useState(true);
  const [fits, setFits] = useState(true);

  // Show the inline ghost only when the caret is at the very end and the textarea has not
  // scrolled — otherwise the mirror would desync from the textarea's own scroll offset.
  const showGhost = completion!.hasGhost && atEnd && fits;

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    setFits(area.scrollHeight <= area.clientHeight + 1);
  }, [text]);

  const syncCaret = () => {
    const area = areaRef.current;
    if (!area) return;
    setAtEnd(area.selectionStart === text.length && area.selectionEnd === text.length);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    completion!.setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Tab" && completion!.hasGhost && showGhost) {
      e.preventDefault();
      const insert = completion!.accept();
      const next = text + insert;
      onChange?.({
        ...e,
        target: { ...e.currentTarget, value: next },
        currentTarget: { ...e.currentTarget, value: next },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
      pick?.(next);
    } else if (e.key === "Escape" && completion!.hasGhost) {
      completion!.dismiss();
    }
  };

  return (
    <div className="relative w-full min-w-0" data-slot="textarea-ai">
      <ArkField.Textarea
        className={cn(textareaBase, "relative bg-transparent", className)}
        data-slot="textarea"
        onChange={handleChange}
        onClick={syncCaret}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCaret}
        ref={areaRef}
        value={value}
        {...rest}
      />
      {/* aria-hidden mirror: an invisible copy of the value with the SAME width/font/padding and
          `pre-wrap` wraps exactly like the textarea, positioning the muted ghost right after the
          caret. Non-interactive; pointer events fall through to the textarea. */}
      <div
        aria-hidden
        className={cn(
          textareaBase,
          "pointer-events-none absolute inset-0 block overflow-hidden whitespace-pre-wrap break-words border-transparent bg-transparent text-transparent shadow-none",
          !showGhost && "invisible",
        )}
      >
        <span className="invisible">{text}</span>
        <span className="text-muted-foreground/64">{completion!.ghost}</span>
      </div>
    </div>
  );
}
