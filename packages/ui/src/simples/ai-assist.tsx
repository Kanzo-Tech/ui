"use client";

// A thin, surface-agnostic AI-assist provider. It runs the two headless engines
// (`useCompletion` + `useSuggestions`) and hands their APIs down through context, so any
// control — `Input`, `CodeEditor`, a bare `Combobox` — can opt into inline ghost completion
// or a candidate menu. Imports **no** `@codemirror/*`, which keeps it root-barrel safe.

import { SparklesIcon, XIcon } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Button } from "./button.js";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover.js";
import { Spinner } from "./spinner.js";
import {
  useCompletion,
  useSuggestions,
  type Completion,
  type Suggestion,
  type Suggestions,
} from "./use-ai.js";

/** Both engines are called unconditionally (stable hook order); these no-op sources stand in
 *  when a prop is absent, and never run because their driving methods stay unwired. */
async function* noComplete(): AsyncIterable<string> {}
async function* noSuggest(): AsyncIterable<Suggestion> {}

export interface AiFieldContext {
  /** Inline continuation engine, or null when no `complete` source was given. */
  completion: Completion | null;
  /** Candidate-menu engine, or null when no `suggest` source was given. */
  suggestions: Suggestions | null;
  /** Route a chosen value back to the caller (a suggestion pick, an applied completion). */
  pick: (value: string) => void;
}

const Ctx = createContext<AiFieldContext | null>(null);

/** Read the AI context; throws outside an `AiAssist`. For parts that require it. */
export function useAiField(): AiFieldContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAiField must be used within <AiAssist>");
  return ctx;
}

/** Read the AI context, or null outside an `AiAssist`. For surfaces that merely opt in. */
export function useAiFieldOptional(): AiFieldContext | null {
  return useContext(Ctx);
}

const noop = () => {};

export interface AiAssistProps {
  /** Streaming inline completion source — yields continuation chunks. */
  complete?: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  debounceMs?: number;
  minLength?: number;
  /** Streaming candidate source for a suggestion menu. */
  suggest?: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
  /** Current values, so suggestions matching them are deduped away. */
  existing?: string[];
  /** How many suggestions to keep on screen. */
  window?: number;
  /** Where a picked value goes. */
  onPick?: (value: string) => void;
  children: ReactNode;
}

export function AiAssist(props: AiAssistProps) {
  const { complete, debounceMs, minLength, suggest, existing, window, onPick, children } = props;

  const completion = useCompletion({ complete: complete ?? noComplete, debounceMs, minLength });
  const suggestions = useSuggestions({
    suggest: suggest ?? noSuggest,
    existing: existing ?? [],
    window,
  });

  const value = useMemo<AiFieldContext>(
    () => ({
      completion: complete ? completion : null,
      suggestions: suggest ? suggestions : null,
      pick: onPick ?? noop,
    }),
    [complete, completion, suggest, suggestions, onPick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface FieldSuggestProps {
  /** Popover heading. */
  title?: string;
  /** Positioning for the candidate popover. */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Accessible label + tooltip for the ✨ trigger. */
  label?: string;
  /** Render one candidate row's content (inside the pick button). */
  renderItem?: (item: Suggestion) => ReactNode;
  className?: string;
}

const defaultItem = (item: Suggestion) => (
  <>
    <span className="text-sm">{item.label ?? item.value}</span>
    {item.rationale && <span className="text-muted-foreground text-xs">{item.rationale}</span>}
  </>
);

/** The ✨ candidate-menu part. Reads `useAiField()` for the suggestions engine + `pick` router;
 *  owns only its open state. A ghost `Button` trigger opens a `Popover` of streamed candidates
 *  (loading / error / empty / list, each row pickable or dismissable). Opening starts the stream,
 *  closing mid-load cancels it. */
export function FieldSuggest(props: FieldSuggestProps) {
  const { title = "Suggestions", placement = "bottom-end", label = "Suggest", renderItem, className } = props;
  const { suggestions, pick: route } = useAiField();
  const [open, setOpen] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!suggestions) return;
    if (next) suggestions.start();
    else if (suggestions.loading) suggestions.cancel();
  };

  const pick = (value: string) => {
    route(value);
    setOpen(false);
  };

  const items = suggestions?.items ?? [];
  const loading = suggestions?.loading ?? false;
  const error = suggestions?.error ?? null;
  const row = renderItem ?? defaultItem;

  return (
    <Popover onOpenChange={(d) => onOpenChange(d.open)} open={open} positioning={{ placement }}>
      <PopoverTrigger asChild>
        <Button aria-label={label} className={className} size="icon-sm" type="button" variant="ghost">
          <SparklesIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[90vw]">
        <PopoverHeader>
          <PopoverTitle className="text-sm">{title}</PopoverTitle>
        </PopoverHeader>
        <PopoverBody className="flex flex-col gap-1">
          {loading && items.length === 0 && (
            <div className="flex items-center gap-2 p-2">
              <Spinner />
              <span className="text-muted-foreground text-xs">Thinking…</span>
            </div>
          )}
          {error && <span className="block p-2 text-destructive text-xs">{error}</span>}
          {!loading && !error && items.length === 0 && (
            <span className="block p-2 text-muted-foreground text-xs">No suggestions</span>
          )}
          {items.map((item, index) => (
            <div className="flex items-center gap-2" key={`${item.value}-${index}`}>
              <button
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-md p-2 text-start outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/32 motion-reduce:transition-none!"
                onClick={() => pick(item.value)}
                type="button"
              >
                {row(item)}
              </button>
              <Button
                aria-label="Dismiss suggestion"
                onClick={() => suggestions?.dismiss(index)}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          ))}
          {loading && items.length > 0 && (
            <div className="flex items-center justify-center pt-2">
              <Spinner />
            </div>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
