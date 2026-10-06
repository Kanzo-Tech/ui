"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { desc, Query, type ExprValue } from "@uwdata/mosaic-sql";
import { bin } from "@uwdata/vgplot";
import {
  ChartAreaIcon,
  ChartBarBigIcon,
  ChartColumnIcon,
  ChartLineIcon,
  ChartScatterIcon,
  ChartSplineIcon,
} from "lucide-react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../simples/card.js";
import { Skeleton } from "../simples/skeleton.js";
import { ChartAxisX, ChartAxisY, ChartFacetX } from "./chart-axes.js";
import type { ChartConfig } from "./chart-config.js";
import { ChartBrushX, ChartBrushXY, ChartHighlight, ChartPickY } from "./chart-interactors.js";
import { ChartLegend } from "./chart-legend.js";
import { ChartAreaY, ChartBarX, ChartDot, ChartLineY, ChartRectY, ChartRegressionY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { EditTileButton } from "./tile-controls.js";
import { measureExpr, tileTitle, type ChartTile, type DashboardChartType } from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { rationale as rationaleOf } from "./recommend.js";
import { useChartQuery } from "./use-chart-query.js";

export interface ChartCardProps extends Omit<React.ComponentProps<typeof Card>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  card: ChartTile;
  /**
   * Per-field series vocabulary — labels, icons and reserved colours for a field drawn as `color`,
   * the way a status column wants its own palette. Fields without one take the categorical scheme
   * in order of frequency over the whole relation, so a filter never repaints a survivor.
   */
  config?: Readonly<Record<string, ChartConfig>>;
  /** Puts an edit button in the header; the host opens the editor. */
  onEdit?: () => void;
}

/** Each chart type's name, icon and gesture — what a card says under its title and the editor lists. */
export const CHART_TYPE: Record<DashboardChartType, { label: string; icon: typeof ChartLineIcon; hint: string }> = {
  bar: { label: "Bar", icon: ChartBarBigIcon, hint: "click a bar to filter" },
  line: { label: "Line", icon: ChartLineIcon, hint: "drag to filter a range" },
  area: { label: "Area", icon: ChartAreaIcon, hint: "drag to filter a range" },
  histogram: { label: "Histogram", icon: ChartColumnIcon, hint: "drag to filter a range" },
  dot: { label: "Scatter", icon: ChartScatterIcon, hint: "drag a box to filter" },
  regression: { label: "Fit", icon: ChartSplineIcon, hint: "drag a box to filter · the fit and its band are SQL aggregates" },
};

/**
 * One `ChartTile`, drawn. The chart is a `ChartRoot` with the marks the type
 * calls for and the interactor its scale allows — pick on a band, brush on a range — so every card
 * publishes into the page's crossfilter and dims or filters with it. Without a series the whole
 * relation stays behind the selection in grey: the context a filtered chart otherwise loses. A card
 * with an `origin` says why the rule proposed it in its description, under an *Automatic* badge,
 * until somebody edits it.
 */
export function ChartCard(props: ChartCardProps) {
  const { table, fields, card, config, onEdit, className, slot, ...rest } = props;
  const missing = [card.x, card.y.field, card.color, card.facet].filter(
    (name): name is string => name !== undefined && !fields.some((f) => f.name === name),
  );
  // The card's `origin` says which rule proposed it; an edit clears it (`edited`).
  const rationale = rationaleOf(card, fields);

  return (
    <Card
      className={cn("[--space:--spacing(4)] min-w-0 gap-3", className)}
      {...rest}
      slot={slot ?? "chart-card"}
    >
      <CardHeader className="gap-0.5">
        <CardTitle className="truncate font-medium text-sm">{tileTitle(card)}</CardTitle>
        <CardDescription className="text-xs">
          {rationale ? `${rationale} · ${CHART_TYPE[card.type].hint}` : CHART_TYPE[card.type].hint}
        </CardDescription>
        {onEdit || rationale ? (
          <CardAction className="-my-1 flex items-center gap-1">
            {rationale ? (
              <Badge size="sm" variant="secondary">
                Automatic
              </Badge>
            ) : null}
            {onEdit ? <EditTileButton label="Edit chart" onClick={onEdit} /> : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {missing.length > 0 ? (
          <p className="flex h-[220px] items-center justify-center text-center text-muted-foreground text-sm">
            {`The relation has no ${missing.join(", ")} any more.`}
          </p>
        ) : (
          <CardChart card={card} config={config} fields={fields} table={table} />
        )}
      </CardContent>
    </Card>
  );
}

const HEIGHT = 220;
const MUTED = "var(--muted-foreground)";
const ACCENT = "var(--chart-1)";
const BAR_LIMIT = 12;
const SERIES_LIMIT = 8;
const FACET_LIMIT = 6;

/** The most frequent values of a field over the whole relation — a stable domain, whatever the filter. */
function useTopValues(table: TableExpr, field: string | undefined, by: ExprValue, limit: number, skip = false) {
  const { rows } = useChartQuery({
    deps: [chartTableKey(table), field, String(by), limit, skip],
    filterBy: null,
    query: () =>
      field === undefined || skip
        ? null
        : Query.from(table).select({ value: field, by }).groupby(field).orderby(desc(by)).limit(limit),
  });
  if (field === undefined || skip) return [];
  return rows === null ? null : rows.map((row) => String(row.value));
}

const truncate = (text: unknown) => {
  const s = String(text);
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
};

function CardChart({
  table,
  fields,
  card,
  config,
}: {
  table: TableExpr;
  fields: readonly FieldStat[];
  card: ChartTile;
  config?: Readonly<Record<string, ChartConfig>>;
}) {
  const y = measureExpr(card.y);
  const given = card.color ? config?.[card.color] : undefined;
  const bars = useTopValues(table, card.type === "bar" ? card.x : undefined, y, BAR_LIMIT);
  const series = useTopValues(table, card.color, measureExpr({ op: "count" }), SERIES_LIMIT, given !== undefined);
  const panels = useTopValues(table, card.facet, measureExpr({ op: "count" }), FACET_LIMIT);
  if (bars === null || series === null || panels === null) return <Skeleton className="h-[220px] w-full" />;

  const seriesConfig: ChartConfig =
    given ?? Object.fromEntries(series.map((value) => [value, { label: value }]));
  const order = Object.keys(seriesConfig);
  const field = fields.find((f) => f.name === card.x);
  const binned = field?.kind === "temporal" || (field?.distinct ?? 0) > 60;
  const x = binned ? bin(card.x) : card.x;
  const fx = card.facet;
  const behind = !card.color;
  const fill = card.color ?? ACCENT;
  const faceted = fx ? { facetMargin: { left: 8, right: 8 }, margin: { top: 26, right: 8, bottom: 24, left: 44 } } : {};
  const frame = {
    config: card.color ? seriesConfig : undefined,
    height: HEIGHT,
    margin: { top: 8, right: 12, bottom: 24, left: 44 },
    table,
    ...faceted,
  };
  const legend = card.color ? <ChartLegend /> : null;
  const facetAxis = fx ? <ChartFacetX domain={panels} label={null} /> : null;

  switch (card.type) {
    case "bar": {
      const left = Math.min(140, Math.max(40, 12 + 6.5 * Math.max(0, ...bars.map((v) => truncate(v).length))));
      return (
        <ChartRoot {...frame} margin={{ top: 4, right: 12, bottom: 24, left: left }}>
          {behind ? <ChartBarX fill={MUTED} filterBy={null} opacity={0.22} x={y} y={card.x} /> : null}
          <ChartBarX fill={fill} insetBottom={1} order={card.color ? order : undefined} x={y} y={card.x} />
          <ChartPickY />
          <ChartHighlight />
          <ChartAxisX grid label={null} ticks={5} />
          <ChartAxisY domain={bars} label={null} tickFormat={truncate} />
          {legend}
        </ChartRoot>
      );
    }
    case "line":
    case "area":
      return (
        <ChartRoot {...frame}>
          {behind ? (
            <ChartLineY fx={fx} stroke={MUTED} strokeOpacity={0.35} strokeWidth={1} filterBy={null} x={x} y={y} />
          ) : null}
          {card.type === "area" ? (
            <ChartAreaY
              fill={fill}
              fillOpacity={behind ? 0.16 : 0.85}
              fx={fx}
              order={card.color ? order : undefined}
              x={x}
              y={y}
            />
          ) : null}
          {card.type === "line" || behind ? (
            <ChartLineY fx={fx} stroke={card.color ?? ACCENT} strokeWidth={1.5} tip x={x} y={y} />
          ) : null}
          <ChartBrushX />
          <ChartAxisX label={null} ticks={fx ? 3 : 8} />
          <ChartAxisY grid label={null} />
          {facetAxis}
          {legend}
        </ChartRoot>
      );
    case "histogram":
      return (
        <ChartRoot {...frame}>
          {behind ? <ChartRectY fill={MUTED} filterBy={null} fx={fx} inset={0.5} opacity={0.22} x={bin(card.x)} y={y} /> : null}
          <ChartRectY fill={fill} fx={fx} inset={0.5} order={card.color ? order : undefined} x={bin(card.x)} y={y} />
          <ChartBrushX />
          <ChartAxisX label={null} ticks={fx ? 3 : 8} />
          <ChartAxisY grid label={null} />
          {facetAxis}
          {legend}
        </ChartRoot>
      );
    case "dot":
    case "regression":
      return (
        <ChartRoot {...frame} margin={fx ? frame.margin : { top: 8, right: 12, bottom: 32, left: 48 }}>
          <ChartDot fill={fill} fillOpacity={0.35} fx={fx} r={1.7} x={card.x} y={card.y.field} />
          {card.type === "regression" ? (
            <ChartRegressionY ci={0.95} fill={ACCENT} fx={fx} stroke={ACCENT} x={card.x} y={card.y.field} />
          ) : null}
          <ChartBrushXY />
          <ChartAxisX label={card.x} ticks={fx ? 3 : 8} />
          <ChartAxisY grid label={card.y.field ?? null} />
          {facetAxis}
          {legend}
        </ChartRoot>
      );
  }
}
