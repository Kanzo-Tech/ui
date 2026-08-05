"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@kanzo-tech/ui";
import { vertexId } from "@kanzo-tech/graph";
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
  /**
   * The dense ids this finding covers. Nothing is queried until the reader asks — a panel should not
   * fetch ids it may never show.
   *
   * Dense ids rather than identities because a panel's answer *is* a query: `SELECT id FROM …` over
   * one relation, and a row has no type column. Completing the pair is this component's job, once,
   * from the spec that says which relation it was.
   */
  load: () => Promise<number[]>;
  /** Shown in the corner and used as this finding's identity, so keep it distinct within a panel. */
  label: string;
  source: SelectionSource;
  disabled?: boolean;
}

export function Finding({ children, disabled, label, load, source }: FindingProps) {
  const { select, selection, spec } = useGraphView();
  const [busy, setBusy] = useState(false);
  const active = selection?.source === source && selection.label === label;

  const toggle = async () => {
    if (active) {
      select(null);
      return;
    }
    setBusy(true);
    try {
      const dense = await load();
      select({ vertices: dense.map((id) => vertexId(spec.typeIndex, id)), source, label });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-pressed={active}
      className={cn(
        "w-full rounded-md border p-2 text-start transition-colors",
        "disabled:cursor-default disabled:opacity-60",
        // Normal / hover / pressed is the ramp's own 3→4→5 progression, written with its names.
        // Over the card, `bg-accent/50` and `bg-accent/60` composite to ΔE 1.21 (light) / 0.86
        // (dark) of each other — under the ΔE 2 the ramp makes a hover owe, so the fill was not
        // carrying the pressed state at all; `--secondary` → `--accent` measures 3.96 / 4.61.
        // The border was carrying it alone, and only for a grey brand: `--primary` is the ink step
        // when the seed has no hue, but step 9 for a client's, where `border-primary/50` measures
        // 1.73–2.32:1 — the failure `stroke-primary/50` had on the canvas. Solid: 3.07–6.07.
        active ? "border-primary bg-accent" : "hover:bg-secondary disabled:hover:bg-transparent",
      )}
      disabled={disabled || busy}
      onClick={() => void toggle()}
      type="button"
    >
      {children}
    </button>
  );
}
