"use client";

import { useEffect, useRef, useState, type Ref } from "react";
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
import type { Suggestion } from "./types.js";

/**
 * ✨ button → a fixed window of streamed suggestions, in a portalled Ark `Popover`.
 * Suggestions stream in one at a time and are deduped live against `existing` and each
 * other; dismissing a row (✕) regenerates another to keep {@link VISIBLE} on screen.
 * Fetched once per open-cycle (cached across reopen); Esc / click-away closes. Domain-free
 * and source-agnostic — the caller passes a plain async iterable `suggest(signal)`.
 */

/** Case-insensitive key for deduping suggestion values. */
const norm = (v: string) => v.trim().toLowerCase();

/** How many suggestions to keep on screen. Dismissing one regenerates another from the
 * stream to keep the window full, so there's always a fixed set to choose from. */
const VISIBLE = 3;

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
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const started = useRef(false); // fetch once per open-cycle, then cache across reopen
  const ctrl = useRef<AbortController>(undefined);
  const iter = useRef<AsyncIterator<Suggestion> | null>(null);
  const seen = useRef<Set<string>>(new Set()); // existing values + everything already shown
  const shown = useRef(0); // live count of visible rows (drives the fill loop)
  const filling = useRef(false); // serialize pulls — one AsyncIterator, one consumer
  const retried = useRef(false); // allow one fresh stream when the first runs dry

  useEffect(() => () => ctrl.current?.abort(), []); // cancel in-flight on unmount

  // Pull the next unique suggestion from the stream — restarting it once when it runs
  // dry — or null when the source can give no more.
  const pull = async (): Promise<Suggestion | null> => {
    for (;;) {
      const signal = ctrl.current?.signal;
      if (!iter.current || signal?.aborted) return null;
      let res: IteratorResult<Suggestion>;
      try {
        res = await iter.current.next();
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "Couldn’t load suggestions");
        return null;
      }
      if (signal?.aborted) return null;
      if (res.done) {
        if (retried.current) return (iter.current = null);
        retried.current = true;
        iter.current = props.suggest(ctrl.current!.signal)[Symbol.asyncIterator]();
        continue;
      }
      const k = norm(res.value.value);
      if (!k || seen.current.has(k)) continue;
      seen.current.add(k);
      return res.value;
    }
  };

  // Top the visible window back up to VISIBLE, appending each as it arrives.
  const fill = async () => {
    if (filling.current) return;
    filling.current = true;
    setLoading(true);
    try {
      while (shown.current < VISIBLE) {
        const next = await pull();
        if (!next) break;
        shown.current += 1;
        setItems((prev) => [...prev, next]);
      }
    } finally {
      filling.current = false;
      setLoading(false);
    }
  };

  const start = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    seen.current = new Set(props.existing.map(norm).filter(Boolean));
    retried.current = false;
    shown.current = 0;
    iter.current = props.suggest(c.signal)[Symbol.asyncIterator]();
    setItems([]);
    setError(null);
    void fill();
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (!started.current) {
        started.current = true;
        start();
      }
    } else if (loading) {
      // Interrupted mid-load: stop the (paid) stream and refetch fresh next time.
      ctrl.current?.abort();
      started.current = false;
      setLoading(false);
    }
  };

  const pick = (value: string) => {
    props.onPick(value);
    setOpen(false);
  };

  // Dismiss one and regenerate another to keep the window full.
  const dismiss = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    shown.current -= 1;
    void fill();
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