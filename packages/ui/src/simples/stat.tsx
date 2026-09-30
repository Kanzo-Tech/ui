import { ark } from "@ark-ui/react/factory";
import { FormatNumber } from "@ark-ui/react/format";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

export interface StatRootProps extends React.ComponentProps<typeof Card> {
  /** The status family, written to `data-variant` and read by `StatIndicator`. */
  variant?: "default" | "success" | "info" | "warning" | "destructive";
}

/**
 * One dashboard number. A `Card`, so `asChild` makes the anchor *be* the tile — one tab stop, and
 * the router seam. The link styles key on the element (`[a&]`, as `Badge` does) rather than on a
 * prop, so they cannot disagree with what was rendered.
 */
export const StatRoot = (props: StatRootProps) => {
  const { variant = "default", className, slot, ...rest } = props;

  return (
    <Card
      className={cn(
        "group/stat [--space:--spacing(4)] px-(--space)",
        // Indicator and label share the first row; the value and the trend share the second.
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-0 gap-y-1",
        "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
        "[a&]:hover:border-primary/40",
        className
      )}
      data-variant={variant}
      {...rest}
      slot={slot ?? "stat-root"}
    />
  );
};

export const StatIndicator = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      aria-hidden
      className={cn(
        "col-start-1 me-2 shrink-0 rounded-full p-1.5 [&_svg]:size-3.5",
        // The soft status pair `Badge` measured: step-11 ink on a 7% wash.
        "bg-muted text-muted-foreground",
        "group-data-[variant=success]/stat:bg-success/7 group-data-[variant=success]/stat:text-success-foreground",
        "group-data-[variant=info]/stat:bg-info/7 group-data-[variant=info]/stat:text-info-foreground",
        "group-data-[variant=warning]/stat:bg-warning/7 group-data-[variant=warning]/stat:text-warning-foreground",
        "group-data-[variant=destructive]/stat:bg-destructive/7 group-data-[variant=destructive]/stat:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "stat-indicator"}
    />
  );
};

/** Sentence case, no trailing colon. */
export const StatLabel = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      className={cn(
        "col-start-2 col-end-[-1] truncate font-medium text-muted-foreground text-sm",
        className
      )}
      {...rest}
      data-slot={slot ?? "stat-label"}
    />
  );
};

export interface StatValueProps extends React.ComponentProps<typeof ark.div> {
  /** Swaps the figure for a skeleton of its size, so the tile does not jump when it lands. */
  loading?: boolean;
}

/**
 * The figure, as the host formats it — `FormatNumber` with `notation="compact"` is the dashboard
 * reading. Proportional figures on purpose: a lone headline number is not a column to align.
 */
export const StatValue = (props: StatValueProps) => {
  const { loading = false, className, children, slot, ...rest } = props;

  return (
    <ark.div
      aria-busy={loading || undefined}
      className={cn(
        "col-start-1 col-end-3 pt-2 font-semibold text-2xl text-foreground leading-none tracking-tight",
        className
      )}
      {...rest}
      data-slot={slot ?? "stat-value"}
    >
      {loading ? <Skeleton className="h-6 w-20" /> : children}
    </ark.div>
  );
};

const statDeltaVariants = tv({
  base: "col-span-full flex items-center gap-1 font-medium text-xs [&_svg]:size-3.5 [&_svg]:shrink-0",
  variants: {
    // Step-11 ink: a delta is 12px text and owes 4.5:1, which the step-9 fill does not reach.
    tone: {
      good: "text-success-foreground",
      bad: "text-destructive-foreground",
      flat: "text-muted-foreground",
    },
  },
});

export interface StatDeltaProps extends React.ComponentProps<typeof ark.div> {
  /** Signed change. Its sign draws the direction icon; with `goodWhenUp`, it picks the colour. */
  value: number;
  /**
   * Against the magnitude, before the comparison — `"%"`, `"pp"`, `"ms"`. "+8.2 vs last week" is a
   * different claim from "+8.2% vs last week".
   */
  unit?: string;
  /** Whether a rise is good. Two more failed runs and two more members are both `+2`. @default true */
  goodWhenUp?: boolean;
}

/** The comparison period is the children: `<StatDelta value={4.2} unit="%">vs last month</StatDelta>`. */
export const StatDelta = (props: StatDeltaProps) => {
  const { value, unit, goodWhenUp = true, className, children, slot, ...rest } = props;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const tone = direction === "flat" ? "flat" : (direction === "up") === goodWhenUp ? "good" : "bad";
  // Never colour alone: the icon carries the direction and the sign carries it in text.
  const Icon = { up: TrendingUpIcon, down: TrendingDownIcon, flat: MinusIcon }[direction];

  return (
    <ark.div
      className={cn(statDeltaVariants({ tone }), className)}
      data-direction={direction}
      {...rest}
      data-slot={slot ?? "stat-delta"}
    >
      <Icon aria-hidden />
      <span>
        <FormatNumber maximumFractionDigits={1} signDisplay="exceptZero" value={value} />
        {unit}
      </span>
      {children != null && <span className="font-normal text-muted-foreground">{children}</span>}
    </ark.div>
  );
};

// `values` is also an SVG animation attribute, meaningless on an `<svg>`; the series takes the name.
export interface StatTrendProps extends Omit<React.ComponentProps<typeof ark.svg>, "values"> {
  /** About a dozen points, oldest first. Fewer than two draws nothing. */
  values: readonly number[];
}

/** A sparkline with its last value marked — unlabelled, because a reader who needs the values needs a chart. */
export const StatTrend = (props: StatTrendProps) => {
  const { values, className, slot, ...rest } = props;
  if (values.length < 2) return null;

  const w = 72;
  const h = 22;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => [i * step, h - ((v - min) / range) * h] as const);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1] ?? [0, 0];

  return (
    <ark.svg
      aria-hidden
      className={cn("col-start-3 ms-3 self-end overflow-visible", className)}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      {...rest}
      data-slot={slot ?? "stat-trend"}
    >
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
      <circle className="fill-primary" cx={lastX} cy={lastY} r={2.5} />
    </ark.svg>
  );
};

export const StatDescription = (props: React.ComponentProps<typeof ark.p>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.p
      className={cn("col-span-full text-muted-foreground text-sm", className)}
      {...rest}
      data-slot={slot ?? "stat-description"}
    />
  );
};
