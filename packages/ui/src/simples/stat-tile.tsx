import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "../lib/cn.js";

/** Auto-compact per the dataviz stat-tile contract: 1,284 · 12.9K · $4.2M. */
function compact(v: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(v);
}

export interface StatTileDelta {
  /** Signed change; its magnitude is shown, its sign + `goodWhenUp` pick the colour. */
  value: number;
  /** The comparison period, e.g. "vs last month". */
  label?: string;
  /**
   * Unit for the magnitude — `"%"`, `"pp"`, `"ms"`, `"°C"`. Sits against the number, before the
   * label, because "+8.2 vs last week" is a different claim from "+8.2% vs last week".
   */
  unit?: string;
  /** Whether an increase is good (green) or bad (red). Default `true`. */
  goodWhenUp?: boolean;
}

export interface StatTileProps {
  /** Sentence case, no trailing colon. */
  label: string;
  value: string | number;
  /** Optional prefix for a numeric value, e.g. "$". */
  prefix?: string;
  delta?: StatTileDelta;
  /** Optional ~12-point trend, drawn as a sparkline. */
  trend?: readonly number[];
  className?: string;
}

function Sparkline({ points }: { points: readonly number[] }) {
  const w = 72;
  const h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, h - ((p - min) / range) * h] as const);
  const d = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1] ?? [0, 0];
  return (
    <svg aria-hidden className="overflow-visible" height={h} viewBox={`0 0 ${w} ${h}`} width={w}>
      {/* A 1.5px trend line is a graphical object carrying information, so it owes 3:1. Diluted it
          measured 2.91:1 on the light page (3.33–3.35 in dark); step 11 solid is 9.19 and 8.52. */}
      <path
        className="text-muted-foreground"
        d={d}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <circle className="fill-primary" cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  );
}

/**
 * A headline figure with its label, an optional signed delta and a trend sparkline — the form for
 * when a single number, not a plot, is the answer (dataviz). The value uses proportional figures;
 * the delta is a reserved status colour paired with a direction icon, never colour alone.
 */
export function StatTile({ label, value, prefix, delta, trend, className }: StatTileProps) {
  const shown = typeof value === "number" ? `${prefix ?? ""}${compact(value)}` : value;
  const up = delta ? delta.value >= 0 : false;
  const good = delta ? up === (delta.goodWhenUp ?? true) : false;
  const DeltaIcon = up ? TrendingUpIcon : TrendingDownIcon;

  return (
    <div
      className={cn("flex flex-col gap-1 rounded-lg border bg-card p-4", className)}
      data-slot="stat-tile"
    >
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="font-semibold text-2xl leading-none tracking-tight text-foreground">
          {shown}
        </span>
        {trend && trend.length > 1 && <Sparkline points={trend} />}
      </div>
      {delta && (
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            good ? "text-success" : "text-destructive dark:text-destructive-foreground",
          )}
        >
          <DeltaIcon className="size-3.5" />
          {delta.value > 0 ? "+" : ""}
          {compact(delta.value)}
          {delta.unit}
          {delta.label && <span className="text-muted-foreground font-normal">{delta.label}</span>}
        </span>
      )}
    </div>
  );
}
