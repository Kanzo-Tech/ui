"use client";

import { cn, FormatNumber, Show, Spinner } from "@kanzo-tech/ui";
import { useGraphState } from "../react/use-graph-state";

export interface GraphCountsProps extends React.ComponentProps<"p"> {
  /** Draws a spinner while the corpus opens or the graph loads — for a host with no status of its own beside it. */
  spinner?: boolean;
}

const COMPACT = { notation: "compact", maximumFractionDigits: 1 } as const;

function Count({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? "—" : <FormatNumber value={value} {...COMPACT} />;
}

/**
 * **What is drawn of the whole, in one sentence** — "1.2K of 5K nodes drawn · 8K edges". `drawn`
 * shrinks with the page's filter and `total` is the manifest's, so the sentence is the filter's
 * effect; an edge counts when both its ends are drawn. A figure not yet known is "—", and the
 * numbers are compact in the nearest `LocaleProvider`'s locale.
 */
export function GraphCounts({ className, slot, spinner = false, ...rest }: GraphCountsProps) {
  const vertices = useGraphState((s) => s.drawn?.vertices);
  const edges = useGraphState((s) => s.drawn?.edges);
  const total = useGraphState((s) => s.total);
  const busy = useGraphState((s) => s.status === "opening" || s.status === "loading");

  return (
    <p
      aria-busy={busy || undefined}
      {...rest}
      className={cn("flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums", className)}
      data-slot={slot ?? "graph-counts"}
    >
      <Show when={spinner && busy}>
        <Spinner className="size-3" />
      </Show>
      <span>
        <Count value={vertices} /> of <Count value={total} /> nodes drawn · <Count value={edges} /> edges
      </span>
    </p>
  );
}
