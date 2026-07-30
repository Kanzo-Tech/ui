"use client";

import { SparklesIcon, XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
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
import { useSuggestions, type Suggestion } from "./use-ai.js";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

interface SuggestCtx {
  items: Suggestion[];
  loading: boolean;
  error: string | null;
  pick: (value: string) => void;
  dismiss: (index: number) => void;
}

const Ctx = React.createContext<SuggestCtx | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <SuggestRoot>`);
  return c;
};

export interface SuggestRootProps {
  suggest: (signal?: AbortSignal) => AsyncIterable<Suggestion>;
  existing?: string[];
  onPick: (value: string) => void;
  placement?: Placement;
  children: React.ReactNode;
}

export function SuggestRoot(props: SuggestRootProps) {
  const { suggest, existing = [], onPick, placement = "bottom-end", children } = props;
  const [open, setOpen] = React.useState(false);
  const { items, loading, error, start, cancel, dismiss } = useSuggestions({ suggest, existing });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) start();
    else if (loading) cancel();
  };

  const pick = (value: string) => {
    onPick(value);
    setOpen(false);
  };

  return (
    <Ctx.Provider value={{ items, loading, error, pick, dismiss }}>
      <Popover onOpenChange={(d) => onOpenChange(d.open)} open={open} positioning={{ placement }}>
        {children}
      </Popover>
    </Ctx.Provider>
  );
}

export function SuggestTrigger({ label = "Suggest", className }: { label?: string; className?: string }) {
  return (
    <PopoverTrigger asChild>
      <Button aria-label={label} className={className} size="icon-sm" type="button" variant="ghost">
        <SparklesIcon />
      </Button>
    </PopoverTrigger>
  );
}

export function SuggestContent(props: {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { title = "Suggestions", className, children } = props;
  const { items, loading, error } = useCtx("SuggestContent");

  return (
    <PopoverContent className={cn("w-80 max-w-[90vw]", className)}>
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
        {children ??
          items.map((item, index) => (
            <SuggestItem index={index} item={item} key={`${item.value}-${index}`} />
          ))}
        {loading && items.length > 0 && (
          <div className="flex items-center justify-center pt-2">
            <Spinner />
          </div>
        )}
      </PopoverBody>
    </PopoverContent>
  );
}

function SuggestItem(props: {
  item: Suggestion;
  index: number;
  children?: React.ReactNode;
}) {
  const { item, index, children } = props;
  const { pick, dismiss } = useCtx("SuggestItem");

  return (
    <div className="flex items-center gap-2">
      <button
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-md p-2 text-start outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none!"
        onClick={() => pick(item.value)}
        type="button"
      >
        {children ?? (
          <>
            <span className="text-sm">{item.label ?? item.value}</span>
            {item.rationale && (
              <span className="text-muted-foreground text-xs">{item.rationale}</span>
            )}
          </>
        )}
      </button>
      <Button
        aria-label="Dismiss suggestion"
        onClick={() => dismiss(index)}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </div>
  );
}
