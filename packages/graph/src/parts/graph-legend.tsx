"use client";

import { cn, Show, useChartCapacity } from "@kanzo-tech/ui";
import { useMemo } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export type GraphLegendProps = React.ComponentProps<"div">;

const shallow = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * **The categorical scale the canvas draws, as rows** — glyph, name and how many vertices of that
 * category are drawn, which under the page's filter reads as a part of its whole: "1,204 of 1,528".
 * What is drawn of the corpus is `GraphCounts`. Unbound, the categories are the vertex types, and
 * with no category at all there is nothing to key, so nothing is drawn.
 * The rows are the domain fixed before the graph loaded, so a row never moves and a colour never
 * changes hands; a category past the palette's capacity is Other, as it is on the canvas.
 *
 * Names are the root's `categories`, never this part's: a legend that renamed a category would be
 * encoding one product's policy, which is the parts rule's reversal.
 */
export function GraphLegend({ className, slot, ...rest }: GraphLegendProps) {
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain, shallow);
  const tally = useGraphState((s) => s.drawn?.tally ?? null);
  const placed = useGraphState((s) => (s.matching === null ? null : (s.drawn?.placed ?? null)));
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;
  const shown = domain.slice(0, capacity);
  const sum = (ns: readonly number[]) => ns.slice(capacity).reduce((total, n) => total + n, 0);
  // Under the page's filter a row says how many of its category the filter keeps: "1,204 of 1,528".
  const count = (n: number | undefined, of: number | undefined) =>
    n === undefined ? "—" : of === undefined ? n.toLocaleString() : `${n.toLocaleString()} of ${of.toLocaleString()}`;
  if (!bound || shown.length === 0) return null;

  return (
    <div
      {...rest}
      className={cn("rounded-lg border bg-card px-2.5 py-2 text-xs", className)}
      data-slot={slot ?? "graph-legend"}
    >
      <ul className="space-y-1.5" data-slot="graph-legend-items">
        {shown.map((value, rank) => (
          <li className="flex items-center gap-2" data-slot="graph-legend-item" key={String(value)}>
            <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />
            <span className="truncate">{nameOf(value, options.categories)}</span>
            <span className="ms-auto ps-4 text-muted-foreground tabular-nums">{count(tally ? (tally[rank] ?? 0) : undefined, placed ? (placed[rank] ?? 0) : undefined)}</span>
          </li>
        ))}
        <Show when={domain.length > capacity}>
          <li className="flex items-center gap-2 border-t pt-1.5" data-slot="graph-legend-item">
            <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(capacity)} shape={scale.shape(capacity)} />
            <span>Other</span>
            <span className="ms-auto ps-4 text-muted-foreground tabular-nums">{count(tally ? sum(tally) : undefined, placed ? sum(placed) : undefined)}</span>
          </li>
        </Show>
      </ul>
    </div>
  );
}
