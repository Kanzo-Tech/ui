"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Spinner,
  useSuggestions,
  type Suggestion,
} from "@kanzo-tech/ui";
import { SparklesIcon, XIcon } from "lucide-react";

const POOL: Suggestion[] = [
  { value: "climate", rationale: "Recurs across every AEMET dataset." },
  { value: "meteorology", rationale: "The domain vocabulary uses this term." },
  { value: "observations", rationale: "Matches the source table name." },
  { value: "spain", rationale: "Every record carries an ES region code." },
  { value: "hourly", rationale: "Sampling interval declared in the schema." },
  { value: "temperature", rationale: "Present in 92% of rows." },
];

// Source-agnostic: any async iterable that honours the signal. A real call site yields straight
// from a streaming model response.
async function* suggest(signal?: AbortSignal): AsyncIterable<Suggestion> {
  for (const item of POOL) {
    await new Promise((r) => setTimeout(r, 240));
    if (signal?.aborted) return;
    yield item;
  }
}

// There is no `SuggestMenu` component — candidate suggestions are composition: a `Popover`, a ✨
// `Button` trigger, and the headless `useSuggestions`. The hook owns the streaming, dedup and
// windowing; you own the markup.
export default function Example() {
  const [keywords, setKeywords] = useState<string[]>(["climate"]);
  const [open, setOpen] = useState(false);
  const { items, loading, error, start, cancel, dismiss } = useSuggestions({
    existing: keywords,
    suggest,
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) start();
    else if (loading) cancel();
  };

  const pick = (value: string) => {
    setKeywords((prev) => [...prev, value]);
    setOpen(false);
  };

  return (
    <div className="flex w-72 items-center gap-2">
      <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1 rounded-md border px-2 py-1">
        {keywords.map((k) => (
          <Badge key={k} size="sm" variant="secondary">
            {k}
          </Badge>
        ))}
      </div>
      <Popover onOpenChange={(d) => onOpenChange(d.open)} open={open} positioning={{ placement: "bottom-end" }}>
        <PopoverTrigger asChild>
          <Button aria-label="Suggest keywords" size="icon-sm" type="button" variant="ghost">
            <SparklesIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-w-[90vw]">
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
              <div className="flex items-center gap-2" key={`${item.value}-${index}`}>
                <button
                  className="flex min-w-0 flex-1 flex-col gap-1 rounded-md p-2 text-start outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/32 motion-reduce:transition-none!"
                  onClick={() => pick(item.value)}
                  type="button"
                >
                  <span className="text-sm">{item.label ?? item.value}</span>
                  {item.rationale && (
                    <span className="text-muted-foreground text-xs">{item.rationale}</span>
                  )}
                </button>
                <Button aria-label="Dismiss suggestion" onClick={() => dismiss(index)} size="icon-sm" variant="ghost">
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
    </div>
  );
}
