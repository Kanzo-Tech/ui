"use client";

import { ark } from "@ark-ui/react/factory";
import { Card, cn, Show, useChartCapacity } from "@kanzo-tech/ui";
import { useId, useMemo } from "react";
import { tv } from "tailwind-variants";
import { nameOf } from "../core/categories";
import { bindingOf } from "../core/channels";
import { useGraphSnapshot, useGraphState } from "../react/use-graph-state";
import { scaleOf } from "../render/graph-model";
import { ShapeGlyph } from "./shape-glyph";

/** The words the legend writes itself; a category's name is the root's `categories`, never this. */
export interface GraphLegendTranslations {
  /** The row for every category past the palette's capacity. */
  other: string;
  /** The heading of the categories a map cannot place. */
  unplaced: string;
  /** Under the rows, when no relation has both ends placed. */
  noEdges: string;
}

const ENGLISH: GraphLegendTranslations = {
  other: "Other",
  unplaced: "No position",
  noEdges: "No edges have both ends on the map.",
};

/** `Card`'s props: the legend is a card, and takes everything one does, `asChild` included. */
export interface GraphLegendProps extends React.ComponentProps<typeof Card> {
  translations?: Partial<GraphLegendTranslations>;
}

const graphLegend = tv({
  slots: {
    root: "[--space:--spacing(2)] gap-0 px-2.5 text-xs shadow-none",
    items: "space-y-1.5",
    item: "flex items-center gap-2",
    other: "border-t pt-1.5",
    glyph: "size-2.5 shrink-0",
    name: "truncate",
    unplaced: "mt-1.5 border-t pt-1.5 text-muted-foreground",
    heading: "mb-1.5",
    note: "mt-1.5 border-t pt-1.5 text-muted-foreground",
  },
});

const shallow = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * **The categorical scale the canvas draws, as rows** — glyph and name, a key and no count. It
 * counted each category, "1,204 of 1,528" under the filter, and with one type that was the page's
 * count a second time beside the `FilterBar` readout and `GraphCounts`; a legend of reference keys
 * and does not count (Tableau, kepler.gl). How many of a type there are is a dashboard's *Count by*
 * question. Unbound, the categories are the vertex types, and with no category at all there is
 * nothing to key, so nothing is drawn.
 * The rows are the domain fixed before the graph loaded, so a row never moves and a colour never
 * changes hands; a category past the palette's capacity is Other, as it is on the canvas.
 *
 * **Under bound positions a category with no position at all is not a row like the others**: it
 * moves into a muted *No position* group with a hollow glyph, because the map hides it rather than
 * greying it. When no relation has both ends placed, a line under the rows says so, so an edgeless
 * map is not read as a corpus without edges.
 *
 * Names are the root's `categories`, never this part's: a legend that renamed a category would be
 * encoding one product's policy, which is the parts rule's reversal.
 */
export function GraphLegend({ className, slot, translations, ...rest }: GraphLegendProps) {
  const t = { ...ENGLISH, ...translations };
  const styles = graphLegend();
  const options = useGraphState((s) => s.options);
  const domain = useGraphState((s) => s.drawn?.domain ?? s.domain, shallow);
  const drawn = useGraphState((s) => s.drawn);
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
  if (domain.length > capacity) rows.push([t.other, capacity]);
  const unplaced = ([, rank]: (typeof rows)[number]) => placing && at(drawn?.placed, rank) === 0 && at(drawn?.totals, rank) > 0;
  const item = ([name, rank]: (typeof rows)[number], hollow?: boolean) => (
    <ark.li className={cn(styles.item(), rank === capacity && !hollow && styles.other())} data-slot="graph-legend-item" key={rank}>
      {hollow ? (
        <ShapeGlyph className={cn(styles.glyph(), "overflow-visible")} color="none" shape={scale.shape(rank)} stroke="currentColor" strokeWidth={1.5} />
      ) : (
        <ShapeGlyph className={styles.glyph()} color={scale.color(rank)} shape={scale.shape(rank)} />
      )}
      <ark.span className={styles.name()}>{name}</ark.span>
    </ark.li>
  );
  const nowhere = rows.filter(unplaced);

  return (
    <Card {...rest} className={cn(styles.root(), className)} slot={slot ?? "graph-legend"}>
      <ark.ul className={styles.items()} data-slot="graph-legend-items">
        {rows.filter((row) => !unplaced(row)).map((row) => item(row))}
      </ark.ul>
      <Show when={nowhere.length > 0}>
        <ark.div className={styles.unplaced()} data-slot="graph-legend-unplaced">
          <ark.p className={styles.heading()} id={heading}>
            {t.unplaced}
          </ark.p>
          <ark.ul aria-labelledby={heading} className={styles.items()}>
            {nowhere.map((row) => item(row, true))}
          </ark.ul>
        </ark.div>
      </Show>
      <Show when={placing && drawn !== null && drawn.links > 0 && drawn.placedLinks === 0}>
        <ark.p className={styles.note()} data-slot="graph-legend-note">
          {t.noEdges}
        </ark.p>
      </Show>
    </Card>
  );
}
