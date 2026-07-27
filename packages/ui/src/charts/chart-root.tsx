"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { Selection, type Coordinator } from "@uwdata/mosaic-core";
import * as vg from "@uwdata/vgplot";
import { cn } from "../lib/cn.js";
import { chartColorScale, chartSeriesColor, colorTokenName, isColorToken, type ChartConfig } from "./chart-config.js";
import {
  buildChartSpec,
  chartSpecSignature,
  chartSpecWarnings,
  compileChartSpec,
  type ChartDirective,
  type ChartFacetOptions,
  type ChartMargin,
  type ChartSpecContext,
} from "./chart-spec.js";
import { useMosaic } from "./mosaic-provider.js";
import { resolveTokenColor } from "./theme.js";
import { TokenizedPlot } from "./tokenized-plot.js";

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
      return fn(data, directive.options);
    }
    case "interactor":
      return directives[directive.interactor]?.(directive.options) ?? null;
    case "attribute":
      return directives[directive.name]?.(directive.value) ?? null;
    case "legend":
      return directives[`${directive.channel}Legend`]?.(directive.options) ?? null;
    case "raw":
      return directive.value as VgDirective;
  }
}

export interface ChartContextValue {
  /** The active Mosaic coordinator, for a consumer that queries alongside the plot. */
  coordinator: Coordinator;
  config: ChartConfig;
  table?: string;
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
export function useChart(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a <ChartRoot>.");
  return ctx;
}

/** The chart context, or `null` — for parts that also work standalone, like `ChartLegend`. */
export function useChartOptional(): ChartContextValue | null {
  return useContext(ChartContext);
}

export interface ChartRootProps
  extends Omit<React.ComponentProps<typeof ark.div>, "children">,
    ChartFacetOptions {
  /** The relation registered in the coordinator. Omit it when every mark carries its own `data`. */
  table?: string;
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
    ...rest
  } = props;
  const { coordinator, crossfilter, selected, registerSelection } = useMosaic();
  // A plain union, so it hides nothing from its own publisher — a crossfilter would, and
  // `ChartHighlight` would read an empty predicate and dim nothing.
  const [own] = useState(() => Selection.union());
  const target = as ?? own;
  const source = filterBy === undefined ? crossfilter : filterBy;
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(
    // Only the selection this root minted is relayed: a caller-supplied `as` was wired by the
    // caller (`include`, or another root), and relaying it again would double every clause.
    () => registerSelection(target, { relay: target === own }),
    [registerSelection, target, own],
  );

  const numberKey = JSON.stringify(numberFormat ?? null);
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
    }),
    // `numberKey` stands in for the options object's identity; `numberFormat` itself is read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coordinator, config, table, source, target, locale, numberKey],
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
        className={cn("flex w-full flex-col gap-2", className)}
        data-slot="chart-root"
        ref={(node: HTMLDivElement | null) => {
          host.current = node;
          assignRef(ref, node);
        }}
        {...rest}
      >
        <TokenizedPlot
          className={plotClassName}
          deps={[
            signature,
            colorKey,
            table,
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
          render={(_colors, width, plotHost) => {
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
            return vg.plot(...spec.map(toVgDirective).filter((d): d is VgDirective => d !== null));
          }}
        />
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
