"use client";

import type React from "react";
import { ark } from "@ark-ui/react/factory";
import type { Selection } from "@uwdata/mosaic-core";
import { cn } from "../lib/cn.js";
import { Swatch } from "../simples/swatch.js";
import { chartSeriesEntries, type ChartConfig } from "./chart-config.js";
import { useChartOptional } from "./chart-root.js";
import { chartDescriptor } from "./chart-spec.js";
import { categoricalColor } from "./theme.js";

export interface ChartLegendProps extends React.ComponentProps<typeof ark.ul> {
  /** Series config. Defaults to the surrounding `<ChartRoot>`'s. */
  config?: ChartConfig;
  /** Standalone shorthand: labels in slot order, the i-th on its scheme slot. */
  series?: readonly string[];
}

function seriesConfig(series: readonly string[]): ChartConfig {
  return Object.fromEntries(series.map((label, i) => [label, { color: categoricalColor(i) }]));
}

/**
 * The identity key for a multi-series chart — our DOM, not vgplot's. Colour is never the only
 * channel (dataviz): the label text carries identity and the swatch is `aria-hidden`.
 */
export function ChartLegend(props: ChartLegendProps) {
  const { config, series, className, ...rest } = props;
  const chart = useChartOptional();
  const resolved = config ?? (series ? seriesConfig(series) : chart?.config) ?? {};

  return (
    <ark.ul
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}
      data-slot="chart-legend"
      {...rest}
    >
      {chartSeriesEntries(resolved).map(({ key, label, color, icon: Icon }) => (
        <ark.li
          className="flex items-center gap-1.5 text-muted-foreground text-xs"
          data-slot="chart-legend-item"
          key={key}
        >
          {/* The swatch colour is data, not a variant — the sanctioned inline-style case. */}
          {Icon ? (
            <span aria-hidden className="shrink-0" style={{ color }}>
              <Icon className="size-3" />
            </span>
          ) : (
            <Swatch color={color} size="xs" />
          )}
          {label}
        </ark.li>
      ))}
    </ark.ul>
  );
}

export interface ChartColorLegendProps {
  /**
   * Where a swatch click publishes. Defaults to `ChartRoot`'s `as`, which makes the legend a
   * filter; pass `null` for a static key.
   */
  as?: Selection | null;
  /** The column the swatches map to, when it cannot be inferred from the channel. */
  field?: string;
  /**
   * Which scale the swatches read. `color` is the usual one; `opacity` and `symbol` legend a plot
   * that encodes its series on those channels instead — a scatter keyed by shape, say.
   */
  channel?: "color" | "opacity" | "symbol";
  /** Any other vgplot legend option (`label`, `columns`, `tickSize`, `width`…). */
  [option: string]: unknown;
}

/**
 * vgplot's own colour legend — a descriptor, drawn inside the plot element and **interactive**:
 * clicking a swatch toggles that series into the selection. Use `ChartLegend` when you want our
 * DOM and the config's labels and icons; use this one when you want click-to-filter.
 */
export const ChartColorLegend = chartDescriptor<ChartColorLegendProps>("ChartColorLegend", (props, ctx) => {
  const { as, channel = "color", ...rest } = props;
  return { kind: "legend", channel, options: { ...rest, as: as === undefined ? ctx.as : as } };
});
