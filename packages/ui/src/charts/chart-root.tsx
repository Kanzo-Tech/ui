"use client";

import {
  holdFirstDraw,
  queryFailure,
  relaySelection,
  type TableExpr,
  Selection,
  type Coordinator,
  type SelectionClause,
} from "@kanzo-tech/mosaic";
import { onRelation, type RelationExpr, type RelationRef } from "@kanzo-tech/relations";
import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import * as vg from "@uwdata/vgplot";
import { cn } from "../lib/cn.js";
import { Show } from "../simples/show.js";
import { chartColorScale, chartSeriesColor, colorTokenName, isColorToken, type ChartConfig } from "./chart-config.js";
import {
  buildChartSpec,
  chartSpecSignature,
  chartSpecWarnings,
  chartTableKey,
  compileChartSpec,
  type ChartDirective,
  type ChartFacetOptions,
  type ChartMarkDirective,
  type ChartMargin,
  type ChartSpecContext,
} from "./chart-spec.js";
import { claimPlace, heldClause, releasePlace, type ClausePlace } from "./clause-place.js";
import { useClientsEnabled, useMosaic, useRelation } from "./mosaic-provider.js";
import { resolveTokenColor } from "../lib/token-color.js";
import { ChartAlternative, readAlternatives, type Alternative, type AlternativeMark } from "./chart-alternative.js";
import { TokenizedPlot } from "./tokenized-plot.js";
import { DenseStackMark } from "./dense-stack.js";

/**
 * What `vg.plot` returns: its element, carrying the `Plot` as `value`. vgplot's marks are Mosaic
 * clients this library does not define, and their `queryError` does nothing — a failed mark leaves
 * the plot on its last render — so `ChartRoot` answers it for them.
 */
type PlotMark = { queryError(error: Error): unknown; enabled: boolean; relation?: RelationRef | null; destroy(): void };
type PlotElement = HTMLElement & {
  value: ChartPlot & { marks: PlotMark[]; pending(mark: PlotMark): void; render(): Promise<void>; element: HTMLElement };
};

/**
 * The vgplot `Plot` a root has on screen, as far as a part may read it: its interactors, which
 * `Plot` exposes. An interactor owns the clause it publishes, so a part that moves a brush asks
 * the brush — `ChartTimeline` plays its window through the interval's own `publish`.
 */
export interface ChartPlot {
  readonly interactors: readonly unknown[];
}

/** An interactor as a rebuild reads it: the clause it publishes, and the value that clause is of. */
interface Publisher {
  value?: unknown;
  selection?: Selection;
  clause?(...args: unknown[]): SelectionClause;
  reset?(): void;
  /** The columns it publishes on, under whichever name its kind gives them: part of its place's key. */
  fields?: unknown[];
  field?: unknown;
  xfield?: unknown;
  yfield?: unknown;
}

/** One place in the plot's interactors, and the page's place for its clause. */
interface Slot {
  readonly place: ClausePlace;
  current: Publisher;
}

/**
 * **An interactor's clause has one source for the root's life, whatever plot draws it — and the
 * page's past it.** A plot is rebuilt on a resize or a theme change, and vgplot builds new
 * interactors with it, each its own clause source. A selection keeps one clause per source, so the
 * old interactor's clause stayed beside the new one's: two windows, intersected. Handing the clause
 * from one to the next was not enough — a rebuild landing before the last one had drawn handed over
 * from an interactor that had not published yet, and a brush gesture begun on the old plot goes on
 * publishing through it. So the interactor at each place publishes under that place's source, which
 * survives the rebuild: whoever publishes, the selection holds one clause. One the plot no longer
 * draws speaks through its heir.
 *
 * Where the grammar is the same, the interactor at the same place, of the same kind, on the same
 * selection, keeps the place and is handed the old one's value — its brush is drawn from it — and,
 * once it has drawn, republishes it for its own marks. Where it is not, the old place is let go and
 * its clause stays the page's (`ClausePlace`); the new interactor takes the page's place for its
 * key — the chart's title, its relation, the place, the interactor's kind and fields — and is handed
 * the clause the page still holds there, as a remount is. Both go by the place's last clause, not by
 * the page's: a brush the page has not delivered yet is still held.
 *
 * Returns what to run once the new plot has drawn.
 */
function handOver(slots: Slot[], after: readonly unknown[], same: boolean, relation: RelationRef | null, title: unknown): () => void {
  const next = after.map((item, i) => {
    const heir = item as Publisher;
    const old = slots[i];
    const keeps = same && old?.current.constructor === heir.constructor && old.current.selection === heir.selection;
    if (old && !keeps) releasePlace(old.place);
    const slot: Slot = keeps
      ? old
      : { place: claimPlace(heir.selection!, `${title}\0${JSON.stringify(relation)}\0${i}\0${heir.constructor.name}\0${[heir.fields, heir.field, heir.xfield, heir.yfield]}`), current: heir };
    if (!keeps) slot.place.onReset = () => slot.current.reset?.();
    heir.value = keeps ? old.current.value : heldClause(slot.place)?.value;
    adopt(slot, heir, relation);
    return slot;
  });
  slots.slice(after.length).forEach((slot) => releasePlace(slot.place));
  slots.splice(0, slots.length, ...next);
  return () =>
    next.forEach((slot, i) => {
      const heir = after[i] as Publisher;
      if (slot.current !== heir) return;
      if (heir.value === undefined) withdraw(slot);
      else if (slot.place.last) heir.selection?.update(heir.clause!(heir.value));
    });
}

/** `interactor` takes `slot`: it publishes under the place's source from now on, on the chart's relation. */
function adopt(slot: Slot, interactor: Publisher, relation: RelationRef | null): void {
  slot.current = interactor;
  const own = interactor.clause?.bind(interactor);
  if (own) {
    interactor.clause = (...args) => {
      // A plot no longer on screen — a brush still mid-gesture — publishes through the one that is.
      if (slot.current !== interactor) {
        if ("value" in slot.current) slot.current.value = args[0];
        return slot.current.clause!(...args);
      }
      return (slot.place.last = onRelation({ ...own(...args), source: slot.place.source }, relation));
    };
  }
}

/** The slot's clause, withdrawn from its selection: its interactor holds no value any more. */
function withdraw(slot: Slot): void {
  const { last } = slot.place;
  const selection = slot.current.selection;
  slot.place.last = undefined;
  if (selection && last) selection.update({ ...last, value: null, predicate: null });
}

/** An area stacked by a series column (the `z` `chart-marks` derives), which `denseStack` completes. */
function isStackedArea(directive: ChartMarkDirective): boolean {
  return (directive.mark === "areaY" || directive.mark === "areaX") && typeof directive.options.z === "string";
}

/** vgplot ships `any` for every directive; this is the one place we pin a shape to it. */
type VgDirective = (plot: unknown) => void;
const directives = vg as unknown as Record<string, ((...args: unknown[]) => VgDirective) | undefined>;

function toVgDirective(directive: ChartDirective): VgDirective | null {
  switch (directive.kind) {
    case "mark": {
      const fn = directives[directive.mark];
      if (!fn) return null;
      // A decorator takes options only; everything else takes (data, options).
      if (directive.source === null) return fn(directive.options);
      const data =
        directive.source.kind === "values"
          ? [...directive.source.values]
          : vg.from(directive.source.table, directive.source.filterBy ? { filterBy: directive.source.filterBy } : undefined);
      if (directive.source.kind === "table" && isStackedArea(directive)) {
        return (plot) => (plot as { addMark: (mark: unknown) => void }).addMark(
          new DenseStackMark(directive.mark, data, directive.options),
        );
      }
      return fn(data, directive.options);
    }
    case "interactor":
      return directives[directive.interactor]?.(directive.options) ?? null;
    case "attribute":
      return directives[directive.name]?.(directive.value) ?? null;
    case "raw":
      return directive.value as VgDirective;
  }
}

export interface ChartContextValue {
  /** The active Mosaic coordinator, for a consumer that queries alongside the plot. */
  coordinator: Coordinator;
  config: ChartConfig;
  /** What the marks read: the root's `relation`, compiled over the provider's joins. */
  table?: TableExpr;
  /** The relation the page knows the chart by — what its clauses are on — or `null` for SQL it names none for. */
  relation: RelationRef | null;
  /** The page's selection: what the marks filter by and the interactors publish into. */
  selection: Selection;
  /**
   * The series colour, normalised to `rgb(...)` so it is safe for both CSS and Plot. `undefined`
   * for a key the config does not name.
   *
   * Normalising is what makes it dual-purpose and is also what makes it a **snapshot**: the answer
   * is read off the DOM when you call it, and nothing re-calls it when the theme or the scheme
   * changes. `ChartLegend` deliberately does not use this — its only sink is a `style`, so it
   * passes `var(--chart-N)` through and lets the browser follow the theme for free. Take the same
   * route for anything that only ends up in CSS; pair this with `useThemeTick` when you need the
   * literal, which is to say when you are handing it to Plot.
   */
  color: (key: string) => string | undefined;
  /** The chart's locale number formatter — one vocabulary for axes, legend and tooltip. */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** The plot on screen, or `null` before the first build. Rebuilt on a resize or a theme change. */
  plot: () => ChartPlot | null;
}

const ChartContext = createContext<ChartContextValue | null>(null);

/**
 * The chart context — config, selections, coordinator, and the `color` / `formatNumber` helpers
 * that keep a series' identity in one place. Throws outside a `<ChartRoot>`.
 *
 * Available to DOM parts (`ChartLegend`, a custom tooltip, a readout). **Not** to descriptors:
 * `ChartRoot` reads their props off the element before React renders them, so a mark cannot pull
 * anything out of context — pass the value down from the component that owns the `<ChartRoot>`.
 */
export function useChartContext(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChartContext must be used within a <ChartRoot>.");
  return ctx;
}

/** The chart context, or `null` — for parts that also work standalone, like `ChartLegend`. */
export function useChartContextOptional(): ChartContextValue | null {
  return useContext(ChartContext);
}

export interface ChartRootProps
  extends Omit<React.ComponentProps<typeof ark.div>, "children">,
    ChartFacetOptions {
  /**
   * What the marks read: a table by name — a type of the provider's `joins`, read as it is — a path
   * over the joins (a `Relation`, compiled with `relationQuery`), or SQL as a mosaic-sql node —
   * `verbatim(relation.sql)`, `asTableRef([catalog, name])`. Its clauses are published on it, and a
   * clause on another relation reaches the marks crossed into it. It may change: the plot re-queries
   * and the clauses it published on the old one stay the page's. Omit it when every mark carries its own
   * `data`.
   */
  relation?: RelationExpr;
  /** Series key → `{ label, color, icon }`. A non-empty config pins the plot's colour scale. */
  config?: ChartConfig;
  /** Plot height in px; the width is measured from the container. Default 200. */
  height?: number;
  margin?: number | ChartMargin;
  aspectRatio?: number;
  /**
   * Raw `vg.*` directives for anything the layer does not wrap. Applied last, so they win.
   * Keep the array referentially stable — a new array rebuilds the plot.
   */
  attributes?: readonly unknown[];
  /** BCP-47 tag for `formatNumber`. Defaults to the runtime locale. */
  locale?: string;
  /** Default options for `formatNumber` — the chart's number vocabulary in one place. */
  numberFormat?: Intl.NumberFormatOptions;
  /** Descriptors (marks, interactors, axes) plus real DOM parts such as `ChartLegend`. */
  children?: ReactNode;
  /** Class for the plot host itself, inside the root. */
  plotClassName?: string;
}

const EMPTY_CONFIG: ChartConfig = {};

/**
 * **Every chart publishes into the page's one selection, and filters by it** — Mosaic's crossfilter:
 * a chart is exempt from the clauses its own interactors publish, so the bars under a brush do not
 * vanish, and a chip's × retracts a clause where it is held, calling the interactor back.
 *
 * Why `ChartHighlight` reads a selection of the chart's own instead. A highlight does not filter — it
 * asks the mark's **own** query which rows are selected, by appending the predicate as an extra output
 * column: `q._groupby.length ? q.select({__: pred})`. On an aggregating mark that query has a
 * `GROUP BY`, so a predicate naming a column this plot does not group by is `Binder Error: column
 * "provider" must appear in the GROUP BY clause`. The query dies, vgplot swallows it, and **the plot
 * keeps its previous render** — no error, no empty state, nothing but a console line. So its default
 * `by` is a plain union the root fills from the page with its own interactors' clauses only — by
 * construction those name the columns its marks group by — following the page, so a clause retracted
 * there stops highlighting here.
 *
 * Until the plot has drawn its first answer it holds the page's first draw (`holdFirstDraw`), so a part
 * whose load should appear with the charts — the graph's canvas — waits for it.
 *
 * ARIA: the root is a `figure`, named by the caller's `aria-label` — a tile passes its title — and
 * `aria-busy` until it has drawn and while a query runs. A test reads where a value falls from the
 * `scale` Plot puts on its own output, so the chart registers nothing with anyone.
 */
export function ChartRoot(props: ChartRootProps) {
  const {
    relation,
    config = EMPTY_CONFIG,
    height = 200,
    margin,
    aspectRatio,
    facetMargin,
    facetGrid,
    facetLabel,
    attributes,
    locale,
    numberFormat,
    children,
    className,
    plotClassName,
    ref,
    slot,
    ...rest
  } = props;
  const { coordinator, selection, onFailure } = useMosaic();
  const read = useRelation(relation);
  const { table } = read;
  const reading = read.relation;
  const [failure, setFailure] = useState<unknown>(undefined);
  // Busy until the first render, so a chart that has not measured its width yet is not read as
  // drawn; where it never can, as under jsdom, it stays busy, which is what it is.
  const [busy, setBusy] = useState(true);
  // What the plot drew, as rows. Read on the settled answer, so a brush at thirty updates a second
  // does not rewrite a table nobody is reading.
  const [answer, setAnswer] = useState<Alternative[]>([]);
  const alternative = useDeferredValue(answer);
  const drawn = useRef<ChartPlot | null>(null);
  /** The grammar and relation the plot on screen was built from: what a rebuild hands over within. */
  const drawnFrom = useRef<string | null>(null);
  /** The clause source of each of the plot's interactors, kept across rebuilds. */
  const slots = useRef<Slot[]>([]);
  const title = rest["aria-label"];
  // A plain union, so it hides nothing from its own publisher — a crossfilter would, and
  // `ChartHighlight` would read an empty predicate and dim nothing.
  const [highlight] = useState(() => Selection.union());
  useEffect(
    () => relaySelection(selection, highlight, { keep: (clause) => slots.current.some((slot) => slot.place.source === clause.source) }),
    [selection, highlight],
  );
  // What the chart published is the page's, and stays when it unmounts (a tab, a dashboard switched
  // to another relation): a chip in the `FilterBar` clears it, and the chart takes it back when it
  // mounts again (`ClausePlace`).
  useEffect(() => () => slots.current.forEach((slot) => releasePlace(slot.place)), [selection]);
  const host = useRef<HTMLDivElement | null>(null);
  // The marks of the plot on screen, so `MosaicClients` reaches them without rebuilding the plot.
  const marks = useRef<readonly PlotMark[]>([]);
  // Each mark is a Mosaic client the plot connected: it leaves the coordinator with the plot, by
  // Mosaic's own `destroy`, or it goes on answering every pick for a plot nobody sees.
  useEffect(() => () => marks.current.forEach((mark) => mark.destroy()), []);
  const enabled = useClientsEnabled();
  useEffect(() => {
    for (const mark of marks.current) mark.enabled = enabled;
  }, [enabled]);
  // The page's first draw waits for this chart while it asks, until its first answer is drawn.
  const [answered, setAnswered] = useState(false);
  useEffect(() => (enabled && !answered ? holdFirstDraw(selection) : undefined), [enabled, answered, selection]);

  const numberKey = JSON.stringify(numberFormat ?? null);
  // The relation as the page knows it is part of what was drawn: its clauses are on it.
  const tableKey = `${chartTableKey(table)}\u0000${JSON.stringify(reading)}`;
  const context = useMemo<ChartContextValue>(
    () => ({
      coordinator,
      config,
      table,
      relation: reading,
      selection,
      color: (key) => {
        const value = chartSeriesColor(config, key);
        if (value === undefined || !isColorToken(value) || typeof document === "undefined") return value;
        // Resolve against the element the chart lives in, so a scoped theme override wins.
        return resolveTokenColor(host.current ?? document.documentElement, colorTokenName(value));
      },
      formatNumber: (value, options) =>
        new Intl.NumberFormat(locale, options ?? numberFormat).format(value),
      plot: () => drawn.current,
    }),
    // `numberKey` and `tableKey` stand in for their objects' identities; both are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coordinator, config, tableKey, selection, locale, numberKey],
  );

  // Compiled twice on purpose: once here with an identity colour resolver, purely to fingerprint
  // the grammar for `deps`, and once inside the render below against the live DOM. The pure pass
  // is what keeps a re-render from re-running every query.
  const pure = compileChartSpec(children, {
    table, filterBy: selection, as: selection, highlight, config, resolveColor: identity,
  });
  const signature = chartSpecSignature(pure);
  const colorKey = JSON.stringify(chartColorScale(config));

  // Keyed by signature so an unchanged chart warns once, not on every render.
  const warned = useRef<string | null>(null);
  if (process.env.NODE_ENV !== "production" && warned.current !== signature) {
    warned.current = signature;
    const context = { shared: [selection] };
    for (const warning of chartSpecWarnings(pure, context)) console.warn(`[ChartRoot] ${warning}`);
  }

  return (
    <ChartContext.Provider value={context}>
      <ark.div
        aria-busy={busy || undefined}
        className={cn("flex w-full flex-col gap-2", className)}
        role="figure"
        ref={(node: HTMLDivElement | null) => {
          host.current = node;
          assignRef(ref, node);
        }}
        {...rest}
        data-slot={slot ?? "chart-root"}
      >
        <TokenizedPlot
          className={cn(plotClassName, failure !== undefined && "hidden")}
          deps={[
            signature,
            colorKey,
            tableKey,
            selection,
            height,
            aspectRatio,
            JSON.stringify(margin ?? null),
            JSON.stringify(facetMargin ?? null),
            facetGrid,
            facetLabel,
            attributes,
          ]}
          render={(width, plotHost) => {
            const cache = new Map<string, string>();
            const ctx: ChartSpecContext = {
              table,
              filterBy: selection,
              as: selection,
              highlight,
              config,
              resolveColor: (token) => {
                const name = colorTokenName(token);
                const hit = cache.get(name);
                if (hit !== undefined) return hit;
                const resolved = resolveTokenColor(plotHost, name);
                cache.set(name, resolved);
                return resolved;
              },
            };
            const spec = buildChartSpec(
              { children, width, height, margin, aspectRatio, facetMargin, facetGrid, facetLabel, attributes },
              ctx,
            );
            setFailure(undefined);
            const element = vg.plot(...spec.map(toVgDirective).filter((d): d is VgDirective => d !== null));
            const plot = (element as PlotElement).value;
            const from = `${tableKey}\u0000${signature}`;
            let handed: (() => void) | null = handOver(slots.current, plot.interactors, drawnFrom.current === from, reading, title ?? null);
            for (const mark of marks.current) mark.destroy();
            marks.current = plot.marks;
            drawn.current = plot;
            drawnFrom.current = from;
            // Busy from each build, and from each query a mark starts, to the render that draws its
            // answer: `pending` and `render` are the two moments vgplot's `Plot` has, and neither has
            // a listener.
            setBusy(true);
            const pending = plot.pending.bind(plot);
            plot.pending = (mark) => {
              setBusy(true);
              pending(mark);
            };
            const render = plot.render.bind(plot);
            plot.render = async () => {
              await render();
              handed?.();
              handed = null;
              setAnswer(readAlternatives(plot.marks as unknown as AlternativeMark[], config));
              setBusy(false);
              setAnswered(true);
            };
            for (const mark of marks.current) {
              mark.enabled = enabled;
              // What the page's resolver crosses every other relation's clauses into.
              mark.relation = reading;
              const own = mark.queryError.bind(mark);
              mark.queryError = (error) => {
                const thrown = queryFailure(error);
                setFailure(() => thrown);
                setBusy(false);
                setAnswered(true);
                onFailure(thrown);
                return own(error);
              };
            }
            return element;
          }}
        />
        <Show when={failure !== undefined}>
          <p
            className="grid place-items-center text-muted-foreground text-xs"
            data-slot="chart-failure"
            style={{ height }}
          >
            This chart could not be drawn.
          </p>
        </Show>
        <ChartAlternative title={typeof title === "string" ? title : undefined} tables={failure === undefined ? alternative : []} />
        {children}
      </ark.div>
    </ChartContext.Provider>
  );
}

function identity(token: string): string {
  return token;
}

/** The root keeps its own handle on the host (for token resolution) without stealing the caller's. */
function assignRef(ref: Ref<HTMLDivElement> | undefined, node: HTMLDivElement | null): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}
