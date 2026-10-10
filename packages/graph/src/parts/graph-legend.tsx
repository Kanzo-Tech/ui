"use client";

import { cn, Show, useChartCapacity } from "@kanzo-tech/ui";
import { useId, useMemo } from "react";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

export type GraphLegendProps = React.ComponentProps<"div">;

const shallow = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * **The categorical scale the canvas draws, as rows** — glyph, name and how many vertices of that
 * category are drawn, which under the page's filter or the canvas's own pick reads as a part of its whole: "1,204 of 1,528".
 * What is drawn of the corpus is `GraphCounts`. Unbound, the categories are the vertex types, and
 * with no category at all there is nothing to key, so nothing is drawn.
 * The rows are the domain fixed before the graph loaded, so a row never moves and a colour never
 * changes hands; a category past the palette's capacity is Other, as it is on the canvas.
 *
 * **Under bound positions a row is what the map places of the category**, "33,447 of 35,122", and
 * a category with no position at all is not a row reading 0: it moves into a muted *No position*
 * group with its whole count and a hollow glyph, because the map hides it rather than greying it.
 * Under the filter a placed row keeps its "n of m" and the group keeps its static totals. When no
 * relation has both ends placed, a line under the rows says so, so an edgeless map is not read as
 * a corpus without edges.
 *
 * Names are the root's `categories`, never this part's: a legend that renamed a category would be
 * encoding one product's policy, which is the parts rule's reversal.
 */
export function GraphLegend({ className, slot, ...rest }: GraphLegendProps) {
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain, shallow);
  const drawn = useGraphState((s) => s.drawn);
  const filtered = useGraphState((s) => s.matching !== null);
  const placing = useGraphSnapshot((s) => s.geometry?.bound === true);
  const capacity = useChartCapacity();
  const scale = useMemo(() => scaleOf(options, capacity), [options, capacity]);
  const heading = useId();
  const binding = bindingOf(options);
  const bound = binding.byTable || binding.category !== undefined;
  const shown = domain.slice(0, capacity);
  if (!bound || shown.length === 0) return null;

  // A rank's count, or past the palette's capacity, Other's: the sum of every rank from there.
  const at = (ns: readonly number[] = [], rank: number) =>
    rank < capacity ? (ns[rank] ?? 0) : ns.slice(capacity).reduce((total, n) => total + n, 0);
  const rows = shown.map((value, rank) => [nameOf(value, options.categories), rank] as const);
  if (domain.length > capacity) rows.push(["Other", capacity]);
  const unplaced = ([, rank]: (typeof rows)[number]) => placing && at(drawn?.placed, rank) === 0 && at(drawn?.totals, rank) > 0;
  // Under the page's filter a row says how many of its category the filter keeps: "1,204 of 1,528";
  // under bound positions with no filter, how many the map places of the category's whole.
  const [part, whole] = filtered ? [drawn?.tally, drawn?.placed] : placing ? [drawn?.placed, drawn?.totals] : [drawn?.tally];
  const count = (rank: number) =>
    drawn === null ? "—" : `${at(part, rank).toLocaleString()}${whole ? ` of ${at(whole, rank).toLocaleString()}` : ""}`;
  const item = ([name, rank]: (typeof rows)[number], hollow?: boolean) => (
    <li className={cn("flex items-center gap-2", rank === capacity && !hollow && "border-t pt-1.5")} data-slot="graph-legend-item" key={rank}>
      {hollow ? (
        <ShapeGlyph className="size-2.5 shrink-0 overflow-visible" color="none" shape={scale.shape(rank)} stroke="currentColor" strokeWidth={1.5} />
      ) : (
        <ShapeGlyph className="size-2.5 shrink-0" color={scale.color(rank)} shape={scale.shape(rank)} />
      )}
      <span className="truncate">{name}</span>
      <span className={cn("ms-auto ps-4 tabular-nums", !hollow && "text-muted-foreground")}>{hollow ? at(drawn?.totals, rank).toLocaleString() : count(rank)}</span>
    </li>
  );
  const nowhere = rows.filter(unplaced);

  return (
    <div
      {...rest}
      className={cn("rounded-lg border bg-card px-2.5 py-2 text-xs", className)}
      data-slot={slot ?? "graph-legend"}
    >
      <ul className="space-y-1.5" data-slot="graph-legend-items">
        {rows.filter((row) => !unplaced(row)).map((row) => item(row))}
      </ul>
      <Show when={nowhere.length > 0}>
        <div className="mt-1.5 border-t pt-1.5 text-muted-foreground" data-slot="graph-legend-unplaced">
          <p className="mb-1.5" id={heading}>
            No position
          </p>
          <ul aria-labelledby={heading} className="space-y-1.5">
            {nowhere.map((row) => item(row, true))}
          </ul>
        </div>
      </Show>
      <Show when={placing && drawn !== null && drawn.links > 0 && drawn.placedLinks === 0}>
        <p className="mt-1.5 border-t pt-1.5 text-muted-foreground" data-slot="graph-legend-note">
          No edges have both ends on the map.
        </p>
      </Show>
    </div>
  );
}
