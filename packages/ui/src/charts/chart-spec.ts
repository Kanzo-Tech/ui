import { Fragment, isValidElement, type ReactNode } from "react";
import type { Selection } from "@uwdata/mosaic-core";
import { isAggregateExpression } from "@uwdata/mosaic-sql";
import { chartColorScale, isColorToken, type ChartConfig } from "./chart-config.js";

/**
 * The plot spec as plain data.
 *
 * `ChartRoot` compiles its descriptor children to this list and only then maps it onto `vg.*`.
 * The indirection is what makes the compiler pure: no coordinator, no DOM, no vgplot — so the
 * grammar is unit-testable and the vgplot binding is a single switch. (`isAggregateExpression` is
 * the one import, a pure AST predicate mosaic-sql exports for exactly this question.)
 */

export type ChartMarkSource =
  | { readonly kind: "table"; readonly table: string; readonly filterBy: Selection | null }
  | { readonly kind: "values"; readonly values: readonly unknown[] }
  /** A decorator mark (`frame`, `gridX`, `gridY`) — takes options only, never data. */
  | null;

export interface ChartMarkDirective {
  readonly kind: "mark";
  readonly mark: string;
  readonly source: ChartMarkSource;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface ChartInteractorDirective {
  readonly kind: "interactor";
  readonly interactor: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface ChartAttributeDirective {
  readonly kind: "attribute";
  readonly name: string;
  readonly value: unknown;
}

export interface ChartLegendDirective {
  readonly kind: "legend";
  readonly channel: "color" | "opacity" | "symbol";
  readonly options: Readonly<Record<string, unknown>>;
}

/** The escape hatch: a `vg.*` directive the layer does not wrap, passed through untouched. */
export interface ChartRawDirective {
  readonly kind: "raw";
  readonly value: unknown;
}

export type ChartDirective =
  | ChartMarkDirective
  | ChartInteractorDirective
  | ChartAttributeDirective
  | ChartLegendDirective
  | ChartRawDirective;

export interface ChartSpecContext {
  /** The relation every table-backed mark reads from. */
  readonly table?: string;
  /** What marks filter by; `null` means "the full relation". */
  readonly filterBy: Selection | null;
  /** Where interactors publish. */
  readonly as: Selection | null;
  readonly config: ChartConfig;
  /** Turns a `var(--token)` / `--token` reference into a Plot-safe colour. */
  readonly resolveColor: (token: string) => string;
}

export type ChartCompile<P> = (props: P, ctx: ChartSpecContext) => ChartDirective | ChartDirective[];

/** An inert child: renders nothing, carries its compilation on a static. */
export interface ChartDescriptor<P> {
  (props: P): null;
  readonly displayName: string;
  readonly __chart: ChartCompile<P>;
}

export function chartDescriptor<P>(displayName: string, compile: ChartCompile<P>): ChartDescriptor<P> {
  return Object.assign(() => null, { displayName, __chart: compile }) as ChartDescriptor<P>;
}

function isChartDescriptor(type: unknown): type is ChartDescriptor<unknown> {
  return typeof type === "function" && typeof (type as { __chart?: unknown }).__chart === "function";
}

/** Guards against a pathological tree; nothing legitimate nests fragments this deep. */
const MAX_DEPTH = 16;

function collect(node: ReactNode, ctx: ChartSpecContext, out: ChartDirective[], depth: number): void {
  if (node == null || typeof node === "boolean" || depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (const child of node) collect(child as ReactNode, ctx, out, depth + 1);
    return;
  }
  if (!isValidElement(node)) return;
  if (node.type === Fragment) {
    collect((node.props as { children?: ReactNode }).children, ctx, out, depth + 1);
    return;
  }
  // Anything else is a DOM child (ChartLegend, a caption…) — rendered, never compiled. A
  // descriptor hidden inside a consumer's own component is invisible here, as in Recharts.
  if (!isChartDescriptor(node.type)) return;
  const produced = node.type.__chart(node.props, ctx);
  if (Array.isArray(produced)) out.push(...produced);
  else out.push(produced);
}

/** The descriptor children, in source order. Fragments and arrays flatten; `null`/`false` vanish. */
export function compileChartSpec(children: ReactNode, ctx: ChartSpecContext): ChartDirective[] {
  const out: ChartDirective[] = [];
  collect(children, ctx, out, 0);
  return out;
}

export interface ChartMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * The plot-wide half of faceting. The panels themselves come from a mark's `fx` / `fy` channels
 * (`<ChartBarY fx="region" />`); per-scale options go on `ChartFacetX` / `ChartFacetY`.
 */
export interface ChartFacetOptions {
  /** Space around each facet panel — the gutter between small multiples. */
  facetMargin?: number | ChartMargin;
  /** Draw the grid across the facet panels. */
  facetGrid?: boolean;
  /** The shared label for the facet axes; `null` removes it. */
  facetLabel?: string | null;
}

export interface ChartSpecOptions extends ChartFacetOptions {
  children: ReactNode;
  /** Measured from the container by `TokenizedPlot`; vgplot defaults to 640 without it. */
  width: number;
  height: number;
  margin?: number | ChartMargin;
  aspectRatio?: number;
  attributes?: readonly unknown[];
}

const MARGIN_SIDES = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" } as const;

function marginDirectives(
  prefix: "margin" | "facetMargin",
  margin: number | ChartMargin | undefined,
): ChartAttributeDirective[] {
  if (margin === undefined) return [];
  const sides: ChartMargin =
    typeof margin === "number" ? { top: margin, right: margin, bottom: margin, left: margin } : margin;
  return (Object.keys(MARGIN_SIDES) as (keyof ChartMargin)[])
    .filter((side) => sides[side] !== undefined)
    .map((side) => ({ kind: "attribute", name: `${prefix}${MARGIN_SIDES[side]}`, value: sides[side] }));
}

/**
 * The whole plot: frame attributes, the config's colour scale, the children, then the raw
 * escape hatch last so a consumer directive can override anything the layer decided.
 */
export function buildChartSpec(options: ChartSpecOptions, ctx: ChartSpecContext): ChartDirective[] {
  const directives: ChartDirective[] = [
    { kind: "attribute", name: "width", value: options.width },
    { kind: "attribute", name: "height", value: options.height },
    ...marginDirectives("margin", options.margin),
    ...marginDirectives("facetMargin", options.facetMargin),
  ];
  if (options.aspectRatio !== undefined) {
    directives.push({ kind: "attribute", name: "aspectRatio", value: options.aspectRatio });
  }
  if (options.facetGrid !== undefined) {
    directives.push({ kind: "attribute", name: "facetGrid", value: options.facetGrid });
  }
  if (options.facetLabel !== undefined) {
    directives.push({ kind: "attribute", name: "facetLabel", value: options.facetLabel });
  }
  const scale = chartColorScale(ctx.config);
  if (scale) {
    directives.push({ kind: "attribute", name: "colorDomain", value: scale.domain });
    directives.push({
      kind: "attribute",
      name: "colorRange",
      value: scale.range.map((c) => (isColorToken(c) ? ctx.resolveColor(c) : c)),
    });
  }
  directives.push(...compileChartSpec(options.children, ctx));
  for (const raw of options.attributes ?? []) directives.push({ kind: "raw", value: raw });
  return directives;
}

/** Marks whose primary channel is a band scale, which an interval brush cannot read. */
const BAND_MARKS: Record<string, "x" | "y"> = {
  barY: "x", waffleY: "x", cellX: "x",
  barX: "y", waffleX: "y", cellY: "y",
};

function component(name: string): string {
  return `<Chart${name[0]!.toUpperCase()}${name.slice(1)}>`;
}

/** A mark whose query carries a `GROUP BY` — any channel holding an aggregate expression. */
function isAggregating(mark: ChartMarkDirective): boolean {
  // `isAggregateExpression` walks a SQL AST and answers 0 for anything that is not a node, so a
  // plain `y="region"` costs one type check rather than a guard here.
  return Object.values(mark.options).some(
    (value) => isAggregateExpression(value as Parameters<typeof isAggregateExpression>[0]) !== 0,
  );
}

/** A cross-filtered selection never reports its own clause back to the client that published it. */
function isCross(selection: Selection): boolean {
  return Boolean(selection.resolver?.cross);
}

export interface ChartSpecWarningContext {
  /**
   * Selections shared by the whole `<MosaicProvider>` — anyone's clause can land in these, so they
   * are never safe as a `ChartHighlight` target on an aggregating mark.
   */
  readonly shared?: readonly unknown[];
}

/**
 * Combinations that fail at *runtime*, reported at build time.
 *
 * Both entries here are silent failures — the kind that costs an afternoon because nothing on
 * screen says anything is wrong.
 *
 * 1. An interval brush over a band scale throws `Unrecognized scale type: band` from Mosaic's
 *    pre-aggregator on pointer-enter — and because that pre-aggregator is coordinator-scoped, the
 *    blast radius is every other chart on the page, which go blank with no error of their own.
 * 2. A `ChartHighlight` pointed at a page-wide selection over an aggregating mark. The highlight
 *    appends its predicate as an extra column on the mark's own `GROUP BY` query, so the first
 *    clause naming a column this plot does not group by is a DuckDB binder error; the query dies
 *    and the plot silently keeps its previous render. The default `by` is the root's own selection
 *    and cannot hit this — only an explicit `by`/`as` naming a shared selection can.
 */
export function chartSpecWarnings(spec: ChartDirective[], context?: ChartSpecWarningContext): string[] {
  const warnings: string[] = [];
  const marks = spec.filter((d): d is ChartMarkDirective => d.kind === "mark");
  const shared = context?.shared ?? [];

  for (const d of spec) {
    if (d.kind !== "interactor") continue;

    if (d.interactor === "highlight") {
      const by = d.options.by as Selection | null | undefined;
      if (!by) continue;
      if (isCross(by)) {
        warnings.push(
          "<ChartHighlight> reads a cross-filtered selection, which by definition hides a clause " +
            "from the client that published it — so the predicate comes back empty and nothing is " +
            "ever dimmed. Drop `by` to use the root's own selection, or point it at a plain union.",
        );
        continue;
      }
      const aggregating = marks.find(isAggregating);
      if (shared.includes(by) && aggregating) {
        warnings.push(
          `<ChartHighlight by={…}> targets a selection shared by the whole <MosaicProvider>, and ` +
            `${component(aggregating.mark)} aggregates. The highlight appends its predicate as a ` +
            "column on that GROUP BY query, so as soon as another chart publishes a clause over a " +
            "column this plot does not group by, DuckDB answers \"must appear in the GROUP BY " +
            "clause\", the query dies and this plot silently keeps its previous render. Drop `by` " +
            "— the root's own selection only ever names columns this plot groups by.",
        );
      }
      continue;
    }

    const axis = d.interactor === "intervalX" ? "x" : d.interactor === "intervalY" ? "y" : null;
    if (!axis) continue;
    const clash = marks.find((m) => BAND_MARKS[m.mark] === axis);
    if (clash) {
      warnings.push(
        `${component(d.interactor)} brushes a band scale ` +
          `(${component(clash.mark)} makes ${axis} categorical). ` +
          "Mosaic throws \"Unrecognized scale type: band\" on hover and blanks every other chart " +
          `sharing the coordinator. Use <ChartToggle${axis.toUpperCase()}> for categories, or bin ${axis} first.`,
      );
    }
  }
  return warnings;
}

/**
 * A stable fingerprint of a compiled spec, for `TokenizedPlot`'s dependency list — the plot is
 * rebuilt (and its queries re-run) only when the grammar actually changed, not on every render.
 * SQL expression nodes (`count()`, `bin(x)`) stringify to their SQL; selections, params and
 * functions fall back to identity, which is stable as long as the caller does not rebuild them.
 */
const identities = new WeakMap<object, number>();
let nextIdentity = 0;

function identityOf(value: object): number {
  let id = identities.get(value);
  if (id === undefined) {
    id = ++nextIdentity;
    identities.set(value, id);
  }
  return id;
}

function tag(value: unknown, depth: number): unknown {
  if (typeof value === "function") return `fn#${identityOf(value)}`;
  if (typeof value === "symbol") return `sym#${String(value.description)}`;
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) return `deep#${identityOf(value)}`;
  if (Array.isArray(value)) return value.map((v) => tag(v, depth + 1));
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tag(v, depth + 1)]));
  }
  let text = "[object]";
  try {
    text = String(value);
  } catch {
    /* a toString that throws is no worse than no toString */
  }
  return text.startsWith("[object") ? `obj#${identityOf(value)}` : text;
}

export function chartSpecSignature(directives: readonly ChartDirective[]): string {
  return JSON.stringify(tag(directives, 0));
}
