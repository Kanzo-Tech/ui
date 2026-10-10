"use client";

import { queryFailure, type TableExpr } from "@kanzo-tech/mosaic";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { Selection, type ClauseSource, type Coordinator, type SelectionClause } from "@uwdata/mosaic-core";
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
import { useClientsEnabled, useMosaic } from "./mosaic-provider.js";
import { resolveTokenColor } from "../lib/token-color.js";
import { TokenizedPlot } from "./tokenized-plot.js";
import { DenseStackMark } from "./dense-stack.js";
import { registerChartForTesting, type PlotOutput } from "./testing-probe.js";

/**
 * What `vg.plot` returns: its element, carrying the `Plot` as `value`. vgplot's marks are Mosaic
 * clients this library does not define, and their `queryError` does nothing — a failed mark leaves
 * the plot on its last render — so `ChartRoot` answers it for them.
 */
type PlotMark = { queryError(error: Error): unknown; enabled: boolean };
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
}

/** One place in the plot's interactors, and the clause source it publishes under for the root's life. */
interface Slot {
  readonly source: ClauseSource;
  current: Publisher;
}

/**
 * **An interactor's clause has one source for the root's life, whatever plot draws it.** A plot is
 * rebuilt on a resize or a theme change, and vgplot builds new interactors with it, each its own
 * clause source. A selection keeps one clause per source, so the old interactor's clause stayed
 * beside the new one's: two windows, intersected. Handing the clause from one to the next was not
 * enough — a rebuild landing before the last one had drawn handed over from an interactor that had
 * not published yet, and a brush gesture begun on the old plot goes on publishing through it. So the
 * interactor at each place publishes under that place's source, which survives the rebuild: whoever
 * publishes, the selection holds one clause. One the plot no longer draws speaks through its heir.
 *
 * Where the grammar is the same, the interactor at the same place, of the same kind, on the same
 * selection, keeps the place and is handed the old one's value — its brush is drawn from it — and,
 * once it has drawn, republishes it for its own marks. Where the grammar changed, a value of the old
 * one means nothing to the new one, and the place's clause is withdrawn at once.
 *
 * Returns what to run once the new plot has drawn, when there is anything.
 */
function handOver(slots: Slot[], after: readonly unknown[], same: boolean): (() => void) | null {
  const moves: (() => void)[] = [];
  const next = after.map((item, i) => {
    const heir = item as Publisher;
    const slot = slots[i];
    const keeps = same && slot !== undefined && slot.current.constructor === heir.constructor && slot.current.selection === heir.selection;
    if (slot && !keeps) withdraw(slot);
    if (!keeps) {
      const fresh: Slot = { source: { reset: () => fresh.current.reset?.() }, current: heir };
      return adopt(fresh, heir);
    }
    heir.value = slot.current.value;
    adopt(slot, heir);
    moves.push(() => {
      if (slot.current !== heir) return;
      if (heir.value === undefined) withdraw(slot);
      else if (heir.selection?.clauses.some((c) => c.source === slot.source)) heir.selection.update(heir.clause!(heir.value));
    });
    return slot;
  });
  slots.slice(after.length).forEach(withdraw);
  slots.splice(0, slots.length, ...next);
  return moves.length > 0 ? () => moves.forEach((move) => move()) : null;
}

/** `interactor` takes `slot`: it publishes under the slot's source from now on. */
function adopt(slot: Slot, interactor: Publisher): Slot {
  slot.current = interactor;
  const own = interactor.clause?.bind(interactor);
  if (own) {
    interactor.clause = (...args) => {
      // A plot no longer on screen — a brush still mid-gesture — publishes through the one that is.
      if (slot.current !== interactor) {
        if ("value" in slot.current) slot.current.value = args[0];
        return slot.current.clause!(...args);
      }
      return { ...own(...args), source: slot.source };
    };
  }
  return slot;
}

/** The slot's clause, withdrawn from its selection. */
function withdraw(slot: Slot): void {
  const selection = slot.current.selection;
  const held = selection?.clauses.find((c) => c.source === slot.source);
  if (selection && held) selection.update({ ...held, value: null, predicate: null });
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
  table?: TableExpr;
  /** What the marks filter by; `null` = the full relation. */
  filterBy: Selection | null;
  /** Where the interactors publish. */
  as: Selection;
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
   * The relation the marks read. A string is one identifier in the default catalog; a relation in
   * another catalog is a mosaic-sql node — `verbatim(relation.sql)`, `asTableRef([catalog, name])`.
   * Omit it when every mark carries its own `data`.
   */
  table?: TableExpr;
  /** What the marks filter by. Defaults to the `<MosaicProvider>` crossfilter; `null` = unfiltered. */
  filterBy?: Selection | null;
  /**
   * Where the child interactors publish, and what `ChartHighlight` reads back. Defaults to a
   * selection this root owns, relayed into the provider — see the note on `ChartRoot`. Pass one and
   * you own its wiring: nothing is relayed for you, though the provider's `reset()` still clears it.
   */
  as?: Selection;
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
 * Why every chart owns a selection instead of sharing the page's.
 *
 * `ChartHighlight` does not filter — it asks the mark's **own** query which rows are selected, by
 * appending the predicate as an extra output column: `q._groupby.length ? q.select({__: pred})`.
 * On an aggregating mark that query has a `GROUP BY`, so a predicate naming a column this plot does
 * not group by is `Binder Error: column "provider" must appear in the GROUP BY clause`. The query
 * dies, vgplot swallows it, and **the plot keeps its previous render** — no error, no empty state,
 * nothing but a console line. It costs hours to find, because the symptom looks like a broken
 * crossfilter three components away.
 *
 * A page-wide publish target guarantees that failure the moment a second chart filters by a second
 * column. So each root publishes into a union of its own: those clauses, by construction, name only
 * columns this plot's own interactors could produce — which are the columns its marks group by. The
 * clauses are relayed on into the provider (`selected` → `crossfilter`) with `source` and `clients`
 * intact, so every other chart filters exactly as before and this one still does not filter itself.
 *
 * ARIA: the root is a `figure`, named by the caller's `aria-label` — a tile passes its title — and
 * `aria-busy` until it has drawn and while a query runs. Its title is also its key in
 * `@kanzo-tech/testing`'s hook, when a test has installed one.
 */
export function ChartRoot(props: ChartRootProps) {
  const {
    table,
    filterBy,
    as,
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
  const { coordinator, crossfilter, selected, registerSelection, onFailure } = useMosaic();
  const [failure, setFailure] = useState<unknown>(undefined);
  // Busy until the first render, so a chart that has not measured its width yet is not read as
  // drawn; where it never can, as under jsdom, it stays busy, which is what it is.
  const [busy, setBusy] = useState(true);
  // Plot's output on screen, for the test hook's scales.
  const output = useRef<PlotOutput | null>(null);
  const drawn = useRef<ChartPlot | null>(null);
  /** The grammar and relation the plot on screen was built from: what a rebuild hands over within. */
  const drawnFrom = useRef<string | null>(null);
  /** The clause source of each of the plot's interactors, kept across rebuilds. */
  const slots = useRef<Slot[]>([]);
  const title = rest["aria-label"];
  useEffect(() => registerChartForTesting(title, () => output.current), [title]);
  // A plain union, so it hides nothing from its own publisher — a crossfilter would, and
  // `ChartHighlight` would read an empty predicate and dim nothing.
  const [own] = useState(() => Selection.union());
  const target = as ?? own;
  const source = filterBy === undefined ? crossfilter : filterBy;
  const host = useRef<HTMLDivElement | null>(null);
  // The marks of the plot on screen, so `MosaicClients` reaches them without rebuilding the plot.
  const marks = useRef<readonly PlotMark[]>([]);
  const enabled = useClientsEnabled();
  useEffect(() => {
    for (const mark of marks.current) mark.enabled = enabled;
  }, [enabled]);

  useEffect(
    // Only the selection this root minted is relayed: a caller-supplied `as` was wired by the
    // caller (`include`, or another root), and relaying it again would double every clause.
    () => registerSelection(target, { relay: target === own }),
    [registerSelection, target, own],
  );

  const numberKey = JSON.stringify(numberFormat ?? null);
  const tableKey = chartTableKey(table);
  const context = useMemo<ChartContextValue>(
    () => ({
      coordinator,
      config,
      table,
      filterBy: source,
      as: target,
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
    [coordinator, config, tableKey, source, target, locale, numberKey],
  );

  // Compiled twice on purpose: once here with an identity colour resolver, purely to fingerprint
  // the grammar for `deps`, and once inside the render below against the live DOM. The pure pass
  // is what keeps a re-render from re-running every query.
  const pure = compileChartSpec(children, {
    table, filterBy: source, as: target, config, resolveColor: identity,
  });
  const signature = chartSpecSignature(pure);
  const colorKey = JSON.stringify(chartColorScale(config));

  // Keyed by signature so an unchanged chart warns once, not on every render.
  const warned = useRef<string | null>(null);
  if (process.env.NODE_ENV !== "production" && warned.current !== signature) {
    warned.current = signature;
    const context = { shared: [crossfilter, selected] };
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
            source,
            target,
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
              filterBy: source,
              as: target,
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
            let handed = handOver(slots.current, plot.interactors, drawnFrom.current === from);
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
              output.current = plot.element.firstElementChild as PlotOutput | null;
              setBusy(false);
            };
            for (const mark of marks.current) {
              mark.enabled = enabled;
              const own = mark.queryError.bind(mark);
              mark.queryError = (error) => {
                const thrown = queryFailure(error);
                setFailure(() => thrown);
                setBusy(false);
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
