"use client";

import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button, ButtonGroup, cn, Skeleton, Suggestion, Suggestions } from "@kanzo-tech/ui";
import type { Proposal } from "./engine.js";

/** How many pills a strip holds room for while its proposals are still arriving. */
export const PILLS = 3;
const PILL_WIDTHS = ["w-44", "w-36", "w-52", "w-40"];

export interface ProposalStripProps {
  /** What the model offered so far. */
  proposals: readonly Proposal[];
  /** Pills in skeleton, standing for the ones still coming. */
  pending: number;
  onSelect?: (text: string) => void;
  /**
   * A ✕ beside each pill, always drawn: a hover-only control is unreachable by keyboard and absent
   * on touch. `label` names it, given the proposal's text.
   */
  dismiss?: { label: (text: string) => string; onDismiss: (text: string) => void };
  /** Words in place of the pills — failed, or nothing to offer. Only where the reader asked. */
  notice?: React.ReactNode;
  className?: string;
  slot?: string;
}

/**
 * The one look of what a model offers, for `Assist`'s candidates and `Chat`'s questions alike.
 *
 * **One pill high even when it holds nothing**, so whatever sits above or below it never moves:
 * arriving, failed or answered. While proposals arrive, pills in skeleton stand for the rest — the
 * same skeleton `ChatSkeleton` draws, so a pending strip is the strip, not a spinner beside it.
 *
 * **No mark leads it.** The pills are `Suggestion`s from `@kanzo-tech/ui`, and what says a model
 * wrote them is where they sit: `Chat`'s panel, or the field whose ✨ asked.
 *
 * **The rationale is the pill's `description`**: in its tooltip and read as its accessible
 * description, at no cost in height.
 */
export function ProposalStrip(props: ProposalStripProps) {
  const { proposals, pending, onSelect, dismiss, notice, className, slot } = props;
  const offering = proposals.length > 0 || pending > 0;
  return (
    <Suggestions aria-busy={pending > 0 || undefined} className={cn("min-h-7 w-full", className)} slot={slot}>
      {proposals.map((p) => {
        const pill = (
          <Suggestion description={p.rationale} key={p.text} onSelect={onSelect} value={p.text}>
            {p.text}
          </Suggestion>
        );
        if (!dismiss) return pill;
        // Two buttons in a group: a `<button>` cannot hold a button.
        return (
          <ButtonGroup aria-label={p.text} key={p.text} slot="proposal">
            {pill}
            <Button
              aria-label={dismiss.label(p.text)}
              className="h-auto min-h-7 self-stretch px-2 py-1"
              onClick={() => dismiss.onDismiss(p.text)}
              pill
              size="sm"
              slot="proposal-dismiss"
              variant="outline"
            >
              <XIcon />
            </Button>
          </ButtonGroup>
        );
      })}
      {Array.from({ length: Math.max(0, pending) }, (_, i) => (
        <Skeleton className={cn("h-7 max-w-full rounded-full", PILL_WIDTHS[i % PILL_WIDTHS.length])} key={i} />
      ))}
      {!offering && notice}
    </Suggestions>
  );
}
