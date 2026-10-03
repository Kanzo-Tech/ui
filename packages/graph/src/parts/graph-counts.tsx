"use client";

import { cn, FormatNumber } from "@kanzo-tech/ui";
import { useGraphState } from "../react/use-graph-state";

export type GraphCountsProps = React.ComponentProps<"p">;

const COMPACT = { notation: "compact", maximumFractionDigits: 1 } as const;

function Count({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? "—" : <FormatNumber value={value} {...COMPACT} />;
}

/**
 * **The corpus in one sentence** — "5K nodes · 8K edges", and under the page's filter "1.2K of 5K
 * nodes match · 3K edges". Nodes are the corpus's, so a filter's effect is `matching` of `total`; a
 * vertex the filter drops is greyed on the canvas, not hidden, which is why the verb is "match" and
 * not "drawn". Edges are those whose two ends are drawn, so they shrink with the filter. A figure
 * not yet known is "—", and the numbers are compact in the nearest `LocaleProvider`'s locale.
 *
 * `aria-busy` follows `status`, because only a load changes these figures; whether a layout runs is
 * `GraphStatus`'s word.
 */
export function GraphCounts({ className, slot, ...rest }: GraphCountsProps) {
  const total = useGraphState((s) => s.total);
  const matching = useGraphState((s) => s.matching);
  const edges = useGraphState((s) => s.drawn?.edges);
  const busy = useGraphState((s) => s.status === "loading");

  return (
    <p
      aria-busy={busy || undefined}
      {...rest}
      className={cn("text-muted-foreground text-xs tabular-nums", className)}
      data-slot={slot ?? "graph-counts"}
    >
      {matching === null ? (
        <>
          <Count value={total} /> nodes
        </>
      ) : (
        <>
          <Count value={matching} /> of <Count value={total} /> nodes match
        </>
      )}{" "}
      · <Count value={edges} /> edges
    </p>
  );
}
