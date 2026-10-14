"use client";

import { ark } from "@ark-ui/react/factory";
import { cn, FormatNumber } from "@kanzo-tech/ui";
import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";

/**
 * The sentence's pieces, each a pattern over figures already formatted: a figure is a node — a
 * `FormatNumber`, or "—" while it is not known — so a pattern places it and never spells it.
 */
export interface GraphCountsTranslations {
  /** *5K nodes*. */
  nodes: (count: ReactNode) => ReactNode;
  /** *33.4K of 206.6K nodes placed*, `placed` being the verb with its explanation. */
  placedNodes: (count: ReactNode, total: ReactNode, placed: ReactNode) => ReactNode;
  /** The verb under bound positions. */
  placed: string;
  /** Its explanation, given the two columns that place a vertex. */
  placedHint: (x: string, y: string) => string;
  /** *2 hidden by other filters*. */
  hidden: (count: ReactNode) => ReactNode;
  /** *8K edges*. */
  edges: (count: ReactNode) => ReactNode;
  /** *0 of 316.8K edges*, under bound positions. */
  placedEdges: (count: ReactNode, total: ReactNode) => ReactNode;
  /** Between two pieces. */
  separator: string;
}

const ENGLISH: GraphCountsTranslations = {
  nodes: (count) => <>{count} nodes</>,
  placedNodes: (count, total, placed) => (
    <>
      {count} of {total} nodes {placed}
    </>
  ),
  placed: "placed",
  placedHint: (x, y) => `On the map: vertices with a value in ${x} and ${y}. The rest have no position.`,
  hidden: (count) => <>{count} hidden by other filters</>,
  edges: (count) => <>{count} edges</>,
  placedEdges: (count, total) => (
    <>
      {count} of {total} edges
    </>
  ),
  separator: " · ",
};

export interface GraphCountsProps extends React.ComponentProps<typeof ark.p> {
  translations?: Partial<GraphCountsTranslations>;
}

const graphCounts = tv({
  slots: {
    root: "text-muted-foreground text-xs tabular-nums",
    verb: "underline decoration-dotted underline-offset-2",
  },
});

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
 * The sentence is its `translations`' patterns over the figures, never English assembled here.
 * `aria-busy` follows `status`, because only a load changes these figures; whether a layout runs is
 * `GraphStatus`'s word.
 */
export function GraphCounts({ className, slot, translations, ...rest }: GraphCountsProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphCounts();
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
    <ark.span className={styles.verb()} title={t.placedHint(String(x), String(y))}>
      {t.placed}
    </ark.span>
  );

  return (
    <ark.p aria-busy={busy || undefined} {...rest} className={cn(styles.root(), className)} data-slot={slot ?? "graph-counts"}>
      {bound ? t.placedNodes(<Count value={placed} />, <Count value={total} />, verb) : t.nodes(<Count value={total} />)}
      {hidden > 0 && (
        <>
          {t.separator}
          {t.hidden(<Count value={hidden} />)}
        </>
      )}
      {t.separator}
      {bound ? t.placedEdges(<Count value={edges} />, <Count value={links} />) : t.edges(<Count value={edges} />)}
    </ark.p>
  );
}
