"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import type React from "react";
import { desc, Query, type ExprValue } from "@uwdata/mosaic-sql";
import { bin } from "@uwdata/vgplot";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartAreaIcon,
  ChartBarBigIcon,
  ChartColumnIcon,
  ChartLineIcon,
  ChartScatterIcon,
  ChartSplineIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "../lib/cn.js";
import { Button } from "../simples/button.js";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../simples/card.js";
import { Field, FieldLabel } from "../simples/field.js";
import { Input } from "../simples/input.js";
import { Skeleton } from "../simples/skeleton.js";
import { ChartAxisX, ChartAxisY, ChartFacetX } from "./chart-axes.js";
import type { ChartConfig } from "./chart-config.js";
import { ChartBrushX, ChartBrushXY, ChartHighlight, ChartPickY } from "./chart-interactors.js";
import { ChartLegend } from "./chart-legend.js";
import { ChartAreaY, ChartBarX, ChartDot, ChartLineY, ChartRectY, ChartRegressionY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { chartTableKey } from "./chart-spec.js";
import { EditPopover, MeasurePick, NONE, Pick, fieldOptions } from "./dashboard-editor.js";
import {
  DASHBOARD_CHART_TYPES,
  cardTitle,
  channelFields,
  measureExpr,
  normalizeCard,
  type DashboardCardSpec,
  type DashboardChartType,
} from "./dashboard-spec.js";
import type { FieldStat } from "./field-stats.js";
import { useChartQuery } from "./use-chart-query.js";

export interface ChartCardProps extends Omit<React.ComponentProps<typeof Card>, "onChange"> {
  table: TableExpr;
  fields: readonly FieldStat[];
  card: DashboardCardSpec;
  /**
   * Per-field series vocabulary — labels, icons and reserved colours for a field drawn as `color`,
   * the way a status column wants its own palette. Fields without one take the categorical scheme
   * in order of frequency over the whole relation, so a filter never repaints a survivor.
   */
  config?: Readonly<Record<string, ChartConfig>>;
  /** Makes the card editable. */
  onChange?: (card: DashboardCardSpec) => void;
  onRemove?: () => void;
  /** Moves the card one place earlier (`-1`) or later (`1`) in the layout. */
  onMove?: (offset: -1 | 1) => void;
}

// Container queries on `Dashboard`'s own width, not the viewport's: beside a dock or in a pane the
// grid is narrower than the screen, and the screen is the wrong thing to measure.
const SPAN = {
  1: "",
  2: "@3xl/dashboard:col-span-2",
  3: "@3xl/dashboard:col-span-2 @6xl/dashboard:col-span-3",
} as const;

const TYPE: Record<DashboardChartType, { label: string; icon: typeof ChartLineIcon; hint: string }> = {
  bar: { label: "Bar", icon: ChartBarBigIcon, hint: "click a bar to filter" },
  line: { label: "Line", icon: ChartLineIcon, hint: "drag to filter a range" },
  area: { label: "Area", icon: ChartAreaIcon, hint: "drag to filter a range" },
  histogram: { label: "Histogram", icon: ChartColumnIcon, hint: "drag to filter a range" },
  dot: { label: "Scatter", icon: ChartScatterIcon, hint: "drag a box to filter" },
  regression: { label: "Fit", icon: ChartSplineIcon, hint: "drag a box to filter · the fit and its band are SQL aggregates" },
};

/**
 * One `DashboardCardSpec`, drawn and editable. The chart is a `ChartRoot` with the marks the type
 * calls for and the interactor its scale allows — pick on a band, brush on a range — so every card
 * publishes into the page's crossfilter and dims or filters with it. Without a series the whole
 * relation stays behind the selection in grey: the context a filtered chart otherwise loses.
 */
export function ChartCard(props: ChartCardProps) {
  const { table, fields, card, config, onChange, onRemove, onMove, className, slot, ...rest } = props;
  const missing = [card.x, card.y.field, card.color, card.facet].filter(
    (name): name is string => name !== undefined && !fields.some((f) => f.name === name),
  );

  return (
    <Card
      className={cn("[--space:--spacing(4)] min-w-0 gap-3", SPAN[card.span ?? 1], className)}
      {...rest}
      slot={slot ?? "chart-card"}
    >
      <CardHeader className="gap-0.5">
        <CardTitle className="truncate font-medium text-sm">{cardTitle(card)}</CardTitle>
        <CardDescription className="text-xs">{TYPE[card.type].hint}</CardDescription>
        {onChange ? (
          <CardAction className="-my-1">
            <CardEditor card={card} fields={fields} onChange={onChange} onMove={onMove} onRemove={onRemove} />
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
  card: DashboardCardSpec;
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

const WIDTHS = [
  { value: "1", label: "A third" },
  { value: "2", label: "Two thirds" },
  { value: "3", label: "Full width" },
];

function CardEditor({
  card,
  fields,
  onChange,
  onRemove,
  onMove,
}: {
  card: DashboardCardSpec;
  fields: readonly FieldStat[];
  onChange: (card: DashboardCardSpec) => void;
  onRemove?: () => void;
  onMove?: (offset: -1 | 1) => void;
}) {
  // A written title describes the encodings it was written for; changing them retires it.
  const set = (next: DashboardCardSpec) => {
    const valid = normalizeCard({ ...next, title: undefined }, fields);
    if (valid) onChange(valid);
  };
  const optional = (channel: "color" | "facet") => [
    { value: NONE, label: "None" },
    ...fieldOptions(channelFields(card.type, channel, fields).filter((f) => f.name !== card.x)),
  ];
  const rows = card.type === "dot" || card.type === "regression";

  return (
    <EditPopover label="Edit chart">
      <div aria-label="Chart type" className="grid grid-cols-3 gap-1" role="group">
        {DASHBOARD_CHART_TYPES.map((type) => {
          const { label, icon: Icon } = TYPE[type];
          const drawable = normalizeCard({ ...card, type }, fields) !== null;
          return (
            <Button
              aria-pressed={card.type === type}
              className="flex-col gap-1 py-1.5 text-xs h-auto"
              disabled={!drawable}
              key={type}
              onClick={() => set({ ...card, type })}
              size="sm"
              variant={card.type === type ? "secondary" : "ghost"}
            >
              <Icon />
              {label}
            </Button>
          );
        })}
      </div>
      <Pick
        label={rows ? "X" : card.type === "bar" ? "Group by" : "Along"}
        onChange={(x) => set({ ...card, x })}
        options={fieldOptions(channelFields(card.type, "x", fields))}
        value={card.x}
      />
      {rows ? (
        <Pick
          label="Y"
          onChange={(field) => set({ ...card, y: { op: "value", field } })}
          options={fieldOptions(channelFields(card.type, "y", fields).filter((f) => f.name !== card.x))}
          value={card.y.field ?? ""}
        />
      ) : (
        <MeasurePick fields={fields} measure={card.y} onChange={(y) => set({ ...card, y })} />
      )}
      <div className="grid grid-cols-2 gap-2">
        {optional("color").length > 1 ? (
          <Pick
            label="Series"
            onChange={(color) => set({ ...card, color: color === NONE ? undefined : color })}
            options={optional("color")}
            value={card.color ?? NONE}
          />
        ) : null}
        {optional("facet").length > 1 ? (
          <Pick
            label="Split into panels"
            onChange={(facet) => set({ ...card, facet: facet === NONE ? undefined : facet })}
            options={optional("facet")}
            value={card.facet ?? NONE}
          />
        ) : null}
      </div>
      <Field className="gap-1">
        <FieldLabel className="text-xs">Title</FieldLabel>
        <Input
          onChange={(event) => onChange({ ...card, title: event.target.value || undefined })}
          placeholder={cardTitle({ ...card, title: undefined })}
          size="sm"
          value={card.title ?? ""}
        />
      </Field>
      <Pick
        label="Width"
        onChange={(span) => onChange({ ...card, span: Number(span) as 1 | 2 | 3 })}
        options={WIDTHS}
        value={String(card.span ?? 1)}
      />
      <div className="flex items-center gap-1">
        {onMove ? (
          <>
            <Button aria-label="Move earlier" onClick={() => onMove(-1)} size="icon-sm" variant="ghost">
              <ArrowLeftIcon className="rtl:rotate-180" />
            </Button>
            <Button aria-label="Move later" onClick={() => onMove(1)} size="icon-sm" variant="ghost">
              <ArrowRightIcon className="rtl:rotate-180" />
            </Button>
          </>
        ) : null}
        {onRemove ? (
          <Button className="ms-auto" onClick={onRemove} size="sm" variant="ghost">
            <Trash2Icon />
            Remove
          </Button>
        ) : null}
      </div>
    </EditPopover>
  );
}
