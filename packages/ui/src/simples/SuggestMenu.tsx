"use client";

import { useState, type Ref } from "react";
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
import { Wand, XIcon } from "lucide-react";
import { useSuggestions, type Suggestion } from "./use-ai.js";

/**
 * ✨ button → a fixed window of streamed suggestions, in a portalled Ark `Popover`.
 * Suggestions stream in one at a time and are deduped live against `existing` and each
 * other; dismissing a row (✕) regenerates another to keep the window full. Fetched once per
 * open-cycle (cached across reopen); Esc / click-away closes. All the streaming lives in
 * {@link useSuggestions}; this file is the surface. Domain-free and source-agnostic — the
 * caller passes a plain async iterable `suggest(signal)`.
 */

export interface SuggestMenuProps {
  /** Streamed candidates. Named `suggest` to sit alongside `CompletionField`'s `complete`, and
   *  because `fetch` shadowed the global while saying nothing about what it returns. */
  suggest: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
  /** Current values — suggestions equal to one of these (case-insensitive) are dropped. */
  existing: string[];
  onPick: (value: string) => void;
  disabled?: boolean;
  /** Forwarded to the trigger button so consumers can measure/target it. */
  ref?: Ref<HTMLButtonElement>;
}

export function SuggestMenu(props: SuggestMenuProps) {
  const [open, setOpen] = useState(false);
  const { items, loading, error, start, cancel, dismiss } = useSuggestions({
    suggest: props.suggest,
    existing: props.existing,
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) start();
    // Interrupted mid-load: stop the (paid) stream and refetch fresh next time.
    else if (loading) cancel();
  };

  const pick = (value: string) => {
    props.onPick(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(d) => onOpenChange(d.open)} positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>
        <Button ref={props.ref} data-slot="suggest-menu" type="button" variant="ghost" size="icon-sm" disabled={props.disabled} aria-label="Suggest a value">
          <Wand />
        </Button>
      </PopoverTrigger>
      {/* Header + body, not bare children: `PopoverContent` owns only the surface — the
          `--space` padding lives on `PopoverHeader` / `PopoverBody`, so anything dropped
          straight into the content sits flush against the border. */}
      <PopoverContent className="w-80 max-w-[90vw]">
        <PopoverHeader>
          <PopoverTitle className="text-sm">Suggestions</PopoverTitle>
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
            <div key={`${item.value}-${index}`} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pick(item.value)}
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-md p-2 text-start transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32 motion-reduce:transition-none!"
              >
                <span className="text-sm">{item.label ?? item.value}</span>
                {item.rationale && <span className="text-muted-foreground text-xs">{item.rationale}</span>}
              </button>
              <Button size="icon-sm" variant="ghost" aria-label="Dismiss suggestion" onClick={() => dismiss(index)}>
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
SuggestMenu.displayName = "SuggestMenu";
