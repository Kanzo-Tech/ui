"use client";

import { cn, FormatNumber } from "@kanzo-tech/ui";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";

export type GraphCountsProps = React.ComponentProps<"p">;

const COMPACT = { notation: "compact", maximumFractionDigits: 1 } as const;

function Count({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? "—" : <FormatNumber value={value} {...COMPACT} />;
}

/**
 * **What is drawn, in one sentence** — "5K nodes · 8K edges". Not what the filters keep: that is
 * the page's one count, the `FilterBar` readout at the top of the page, and this said it too
 * ("1.2K match"), as did the legend and a toolbar box — four figures for one thing. What only this
 * sentence says stays: edges are those whose two ends are drawn, so they shrink with the filter, and
 * *M hidden by other filters* counts what the canvas's pick holds that another filter hides. A
 * figure not yet known is "—", and the numbers are compact in the nearest `LocaleProvider`'s locale.
 *
 * **Under bound positions the verb is "placed"**, because there a vertex with no value in `x` or
 * `y` is hidden, not greyed: "33.4K of 206.6K nodes placed · 0 of 316.8K edges". Both figures are
 * drawn of total, so a map that leaves most of the corpus out says so instead of reading as missing
 * data.
 *
 * `aria-busy` follows `status`, because only a load changes these figures; whether a layout runs is
 * `GraphStatus`'s word.
 */
export function GraphCounts({ className, slot, ...rest }: GraphCountsProps) {
  const total = useGraphState((s) => s.total);
  // What the canvas holds that another filter hides: the one figure only this sentence says.
  const hidden = useGraphState((s) => (s.selection !== null && s.matching !== null ? s.selection.vertices.length - s.matching : 0));
  const edges = useGraphState((s) => s.drawn?.edges);
  const busy = useGraphState((s) => s.status === "loading");
  const bound = useGraphSnapshot((s) => s.geometry?.bound === true);
  const placed = useGraphState((s) => s.drawn?.placed.reduce((sum, n) => sum + n, 0));
  const links = useGraphState((s) => s.drawn?.links);
  const x = useGraphState((s) => s.options.x);
  const y = useGraphState((s) => s.options.y);
  const verb = (
    <span className="underline decoration-dotted underline-offset-2" title={`On the map: vertices with a value in ${x} and ${y}. The rest have no position.`}>
      placed
    </span>
  );

  return (
    <p
      aria-busy={busy || undefined}
      {...rest}
      className={cn("text-muted-foreground text-xs tabular-nums", className)}
      data-slot={slot ?? "graph-counts"}
    >
      {bound ? (
        <>
          <Count value={placed} /> of <Count value={total} /> nodes {verb}
        </>
      ) : (
        <>
          <Count value={total} /> nodes
        </>
      )}{" "}
      {hidden > 0 && (
        <>
          · <Count value={hidden} /> hidden by other filters{" "}
        </>
      )}
      · <Count value={edges} />
      {bound ? " of " : null}
      {bound ? <Count value={links} /> : null} edges
    </p>
  );
}
