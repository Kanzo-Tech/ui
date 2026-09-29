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
 * **The categorical scale the canvas draws, as rows** — glyph, name and how many vertices the marks of
 * that category stand for in view, then what is drawn of the whole. The rows are the domain fixed
 * before any tile arrived, so a row never moves and a colour never changes hands; a category past the
 * palette's capacity is Other, as it is on the canvas.
 *
 * Names are the root's `categories`, never this part's: a legend that renamed a category would be
 * encoding one product's policy, which is the parts rule's reversal.
 */
export function GraphLegend({ className, slot, ...rest }: GraphLegendProps) {
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain, shallow);
  const tally = useGraphState((s) => s.drawn?.tally ?? null);
  const represented = useGraphState((s) => s.drawn?.represented ?? null);
  const total = useGraphState((s) => s.total);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const bound = bindingOf(options).category !== undefined;
  const shown = domain.slice(0, capacity);
  const other = tally ? tally.slice(capacity).reduce((sum, n) => sum + n, 0) : null;
  const count = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString());

  return (
    <div
      {...rest}
      className={cn("rounded-lg border bg-card px-2.5 py-1.5 text-xs", className)}
      data-slot={slot ?? "graph-legend"}
    >
      <Show when={bound && shown.length > 0}>
        <ul className="space-y-1" data-slot="graph-legend-items">
          {shown.map((value, rank) => (
            <li className="flex items-center gap-2" data-slot="graph-legend-item" key={String(value)}>
              <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />
              <span className="truncate">{nameOf(value, options.categories)}</span>
              <span className="ms-auto ps-4 text-muted-foreground tabular-nums">{count(tally ? (tally[rank] ?? 0) : null)}</span>
            </li>
          ))}
          <Show when={domain.length > capacity}>
            <li className="flex items-center gap-2" data-slot="graph-legend-item">
              <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(capacity)} shape={scale.shape(capacity)} />
              <span>Other</span>
              <span className="ms-auto ps-4 text-muted-foreground tabular-nums">{count(other)}</span>
            </li>
          </Show>
        </ul>
      </Show>
      <p
        className={cn("text-muted-foreground tabular-nums", bound && shown.length > 0 && "mt-1 border-t pt-1")}
        data-slot="graph-legend-count"
      >
        {count(represented)} of {count(total)} drawn
      </p>
    </div>
  );
}
