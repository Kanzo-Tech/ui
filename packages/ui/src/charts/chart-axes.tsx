import { chartDescriptor, type ChartAttributeDirective, type ChartDescriptor } from "./chart-spec.js";

/**
 * Scale descriptors: the position scales (`x`/`y`) and the facet scales (`fx`/`fy`).
 *
 * They compile to plot **attributes** (`xTickRotate`, `fyGrid`…), not to vgplot's `axisX`/`axisFy`
 * decorator marks — an attribute cannot become the mark a following interactor binds itself to.
 * The subset here is what charts actually use; the rest goes through `ChartRoot`'s `attributes`.
 */

/** What every scale has, position or facet. */
interface ChartScalePropsBase {
  /** Axis label. `null` removes it. */
  label?: string | null;
  /** A tick count, an interval name, or explicit tick values. */
  ticks?: unknown;
  tickFormat?: unknown;
  tickSize?: number;
  tickRotate?: number;
  grid?: boolean;
  line?: boolean;
  domain?: readonly unknown[];
  reverse?: boolean;
  inset?: number;
  padding?: number;
}

interface ChartAxisPropsBase extends ChartScalePropsBase {
  /** `"linear"`, `"log"`, `"band"`, `"utc"`… `null` disables the scale. */
  scale?: string | null;
  nice?: boolean | number;
  zero?: boolean;
  percent?: boolean;
}

export interface ChartAxisXProps extends ChartAxisPropsBase {
  /** Which side the axis is drawn on; `null` hides it while keeping the scale. */
  anchor?: "top" | "bottom" | null;
}

export interface ChartAxisYProps extends ChartAxisPropsBase {
  /** Which side the axis is drawn on; `null` hides it while keeping the scale. */
  anchor?: "left" | "right" | null;
}

export interface ChartFacetXProps extends ChartScalePropsBase {
  /** Which side the facet axis is drawn on; `null` hides it while keeping the panels. */
  anchor?: "top" | "bottom" | null;
}

export interface ChartFacetYProps extends ChartScalePropsBase {
  /** Which side the facet axis is drawn on; `null` hides it while keeping the panels. */
  anchor?: "left" | "right" | null;
}

/** prop → attribute suffix; `anchor` is the odd one out, it is the axis attribute itself. */
const SCALE_SUFFIX: Record<string, string> = {
  anchor: "Axis",
  label: "Label",
  ticks: "Ticks",
  tickFormat: "TickFormat",
  tickSize: "TickSize",
  tickRotate: "TickRotate",
  grid: "Grid",
  line: "Line",
  domain: "Domain",
  reverse: "Reverse",
  inset: "Inset",
  padding: "Padding",
};

/** The position scales carry four attributes the facet scales have no equivalent for. */
const AXIS_SUFFIX: Record<string, string> = {
  ...SCALE_SUFFIX,
  scale: "Scale",
  nice: "Nice",
  zero: "Zero",
  percent: "Percent",
};

type ScaleProps = ChartScalePropsBase & { anchor?: string | null };

function scale(displayName: string, prefix: string, suffixes: Record<string, string>): ChartDescriptor<ScaleProps> {
  return chartDescriptor(displayName, (props) => {
    const out: ChartAttributeDirective[] = [];
    for (const [prop, value] of Object.entries(props)) {
      const suffix = suffixes[prop];
      // `undefined` means "unspecified"; `null` is a real value (hide the axis, drop the label).
      if (suffix === undefined || value === undefined) continue;
      out.push({ kind: "attribute", name: `${prefix}${suffix}`, value });
    }
    return out;
  });
}

export const ChartAxisX = scale("ChartAxisX", "x", AXIS_SUFFIX) as ChartDescriptor<ChartAxisXProps>;
export const ChartAxisY = scale("ChartAxisY", "y", AXIS_SUFFIX) as ChartDescriptor<ChartAxisYProps>;

/**
 * Small multiples. Plot facets by the `fx` / `fy` channels of a mark — `<ChartBarY fx="region" />`
 * splits the plot into one panel per region — and these two configure the resulting facet scale,
 * exactly as `ChartAxisX` / `ChartAxisY` configure the position scales. Panel spacing, cross-panel
 * grid and the shared facet label are plot-wide, so they live on `ChartRoot` instead.
 */
export const ChartFacetX = scale("ChartFacetX", "fx", SCALE_SUFFIX) as ChartDescriptor<ChartFacetXProps>;
export const ChartFacetY = scale("ChartFacetY", "fy", SCALE_SUFFIX) as ChartDescriptor<ChartFacetYProps>;
