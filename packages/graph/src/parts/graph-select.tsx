"use client";

import { useState } from "react";
import { cn } from "@kanzo-tech/ui";
import type { VertexId } from "../core/types";
import { useGraphContext } from "../react/graph-root";
import { useGraphState } from "../react/use-graph-state";

export interface GraphSelectProps extends Omit<React.ComponentProps<"button">, "onClick" | "type"> {
  /**
   * The vertices this control selects — `dense_id`s, as SQL returns them. Called when the reader
   * presses it and not before, so a panel of fifty findings reads nothing until one is asked for.
   */
  load: () => Promise<readonly VertexId[]>;
  /** What the corner calls the selection, and its identity: keep it distinct among a panel's controls. */
  label: string;
}

/**
 * **A selection the host offers, as a toggle** — *these vertices, on the canvas*. Pressing it calls
 * `load` and selects what it answers as an `"external"` selection named `label`; pressing it again
 * clears it. Whatever the host renders inside is the clickable body: a rule and its count, an answer.
 *
 * The pressed state is **derived** from the live selection — `source === "external"` and the same
 * `label` — rather than stored beside it. A stored flag goes stale the moment the reader lassoes
 * something else; a selection cannot disagree with itself. It is disabled while `load` runs.
 *
 * **A rejected `load` reaches the root's `onFailure`, as thrown** — as `GraphSearch`'s failed read
 * does — and the control stays unpressed, ready to be pressed again. It takes no handler of its own:
 * what a failure shows is the host's policy, and the root is where that lives.
 *
 * ARIA: a `button` with `aria-pressed`, the toggle-button pattern; its name is its content.
 */
export function GraphSelect({ children, className, disabled, label, load, slot, ...rest }: GraphSelectProps) {
  const api = useGraphContext();
  const pressed = useGraphState((s) => s.selection?.source === "external" && s.selection.label === label);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (pressed) {
      api.select(null);
      return;
    }
    setBusy(true);
    try {
      api.select(await load(), "external", label);
    } catch (error) {
      api.getState().options.onFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-pressed={pressed}
      {...rest}
      className={cn(
        "w-full rounded-md border p-2 text-start transition-colors",
        "disabled:cursor-default disabled:opacity-60",
        // Normal / hover / pressed is the ramp's own 3→4→5 progression, written with its names.
        // Over the card, `bg-accent/50` and `bg-accent/60` composite to ΔE 1.21 (light) / 0.86
        // (dark) of each other — under the ΔE 2 the ramp makes a hover owe, so the fill was not
        // carrying the pressed state at all; `--secondary` → `--accent` measures 3.96 / 4.61.
        // `border-primary/50` measures 1.73–2.32:1 for a hued seed, the failure `stroke-primary/50`
        // had on the canvas; solid measures 3.07–6.07 (measured 2026-09, in the workspace showcase).
        pressed ? "border-primary bg-accent" : "hover:bg-secondary disabled:hover:bg-transparent",
        className,
      )}
      data-slot={slot ?? "graph-select"}
      disabled={disabled || busy}
      onClick={() => void toggle()}
      type="button"
    >
      {children}
    </button>
  );
}
