"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@kanzo-tech/ui";
import { useGraphView, type SelectionSource } from "./graph-state";

/**
 * A finding you can point the canvas at.
 *
 * The Rules panel and the Ask panel were making the same offer in two different shapes: Rules gave
 * you a clickable card that toggled, Ask gave you prose with a separate "Focus these N" button that
 * did not. Same promise — *these nodes, on the canvas* — so it should be one affordance, and this
 * is it. Whatever a panel renders inside becomes the clickable body.
 *
 * The pressed state is **derived** from the live selection rather than stored beside it, and that
 * is the part that matters. Rules used to keep its own `focused` id, which went stale the moment
 * you lassoed something else: the rule stayed lit while the selection it claimed had long since
 * moved. A single source cannot disagree with itself.
 */
export interface FindingProps {
  children: ReactNode;
  /** Nothing is queried until the reader asks — a panel should not fetch ids it may never show. */
  load: () => Promise<number[]>;
  /** Shown in the corner and used as this finding's identity, so keep it distinct within a panel. */
  label: string;
  source: SelectionSource;
  disabled?: boolean;
}

export function Finding({ children, disabled, label, load, source }: FindingProps) {
  const { select, selection } = useGraphView();
  const [busy, setBusy] = useState(false);
  const active = selection?.source === source && selection.label === label;

  const toggle = async () => {
    if (active) {
      select(null);
      return;
    }
    setBusy(true);
    try {
      select({ ids: await load(), source, label });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-pressed={active}
      className={cn(
        "w-full rounded-md border p-2 text-start transition-colors",
        "hover:bg-accent/50 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
        active && "border-primary/50 bg-accent/60",
      )}
      disabled={disabled || busy}
      onClick={() => void toggle()}
      type="button"
    >
      {children}
    </button>
  );
}
