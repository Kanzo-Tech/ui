"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { useCompletion } from "./use-ai.js";

type FieldEl = HTMLInputElement | HTMLTextAreaElement;

interface CompleteCtx {
  fieldRef: React.RefObject<FieldEl | null>;
  value: string;
  ghost: string;
  hasGhost: boolean;
  atEnd: boolean;
  metrics: React.CSSProperties;
  onChange: (e: React.ChangeEvent<FieldEl>) => void;
  onKeyDown: (e: React.KeyboardEvent<FieldEl>) => void;
  syncCaret: () => void;
}

const Ctx = React.createContext<CompleteCtx | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <CompleteRoot>`);
  return c;
};

const METRICS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;

const readMetrics = (el: FieldEl): React.CSSProperties => {
  const cs = getComputedStyle(el);
  const out: Record<string, string> = { borderStyle: "solid", borderColor: "transparent" };
  for (const k of METRICS) out[k] = cs[k as keyof CSSStyleDeclaration] as string;
  return out as React.CSSProperties;
};

export interface CompleteRootProps {
  complete: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  value: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
  minLength?: number;
  className?: string;
  children: React.ReactNode;
}

export function CompleteRoot(props: CompleteRootProps) {
  const { complete, value, onValueChange, debounceMs, minLength, className, children } = props;
  const completion = useCompletion({ complete, debounceMs, minLength });
  const fieldRef = React.useRef<FieldEl | null>(null);
  const [atEnd, setAtEnd] = React.useState(true);
  const [metrics, setMetrics] = React.useState<React.CSSProperties>({});

  // The ghost mirror wears the field's real metrics, so it aligns whatever the size/className.
  React.useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const sync = () => setMetrics(readMetrics(el));
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const syncCaret = React.useCallback(() => {
    const el = fieldRef.current;
    if (el) setAtEnd(el.selectionStart === value.length && el.selectionEnd === value.length);
  }, [value.length]);

  const onChange = React.useCallback(
    (e: React.ChangeEvent<FieldEl>) => {
      onValueChange(e.target.value);
      completion.setValue(e.target.value);
    },
    [onValueChange, completion],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<FieldEl>) => {
      if (e.defaultPrevented) return;
      if (e.key === "Tab" && completion.hasGhost && atEnd) {
        e.preventDefault();
        onValueChange(value + completion.accept());
      } else if (e.key === "Escape" && completion.hasGhost) {
        completion.dismiss();
      }
    },
    [completion, atEnd, onValueChange, value],
  );

  const ctx: CompleteCtx = {
    fieldRef, value, ghost: completion.ghost, hasGhost: completion.hasGhost,
    atEnd, metrics, onChange, onKeyDown, syncCaret,
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className={cn("relative w-full min-w-0", className)} data-slot="complete">
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function CompleteInput({ children }: { children: React.ReactElement }) {
  const ctx = useCtx("CompleteInput");
  return (
    <ark.input
      asChild
      data-slot="complete-input"
      onChange={ctx.onChange}
      onClick={ctx.syncCaret}
      onKeyDown={ctx.onKeyDown}
      onKeyUp={ctx.syncCaret}
      ref={ctx.fieldRef as React.Ref<HTMLInputElement>}
      value={ctx.value}
    >
      {children}
    </ark.input>
  );
}

export function CompleteTextarea({ children }: { children: React.ReactElement }) {
  const ctx = useCtx("CompleteTextarea");
  return (
    <ark.textarea
      asChild
      data-slot="complete-input"
      onChange={ctx.onChange}
      onClick={ctx.syncCaret}
      onKeyDown={ctx.onKeyDown}
      onKeyUp={ctx.syncCaret}
      ref={ctx.fieldRef as React.Ref<HTMLTextAreaElement>}
      value={ctx.value}
    >
      {children}
    </ark.textarea>
  );
}

/** Single-line overlay for `CompleteInput`. */
export function CompleteGhost({ className }: { className?: string }) {
  const ctx = useCtx("CompleteGhost");
  const mirrorRef = React.useRef<HTMLSpanElement>(null);
  const [fits, setFits] = React.useState(true);

  React.useLayoutEffect(() => {
    const el = ctx.fieldRef.current;
    const mirror = mirrorRef.current;
    if (el && mirror) setFits(mirror.scrollWidth <= el.clientWidth);
  }, [ctx.fieldRef, ctx.value, ctx.ghost]);

  const show = ctx.hasGhost && ctx.atEnd && fits;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-transparent",
        !show && "invisible",
        className,
      )}
      data-slot="complete-ghost"
      style={ctx.metrics}
    >
      <span className="invisible" ref={mirrorRef}>
        {ctx.value}
      </span>
      <span className="text-muted-foreground/64">{ctx.ghost}</span>
    </div>
  );
}

/** Below-field hint for `CompleteTextarea`. */
export function CompleteHint({ className }: { className?: string }) {
  const ctx = useCtx("CompleteHint");
  if (!ctx.hasGhost) return null;
  return (
    <p
      className={cn("mt-1.5 whitespace-pre-wrap break-words text-muted-foreground text-sm", className)}
      data-slot="complete-hint"
    >
      <span className="text-muted-foreground/64">{ctx.ghost.replace(/^\s+/, "")}</span>{" "}
      <kbd className="rounded border px-1 text-xs">Tab</kbd>
    </p>
  );
}
