// MetricCard is a SHOWCASE composition, not a library export. A dashboard tile is just a Card
// with a status tint, a skeleton-swapping figure and an optional link — none of which is new
// behaviour, so per DESIGN.md it lives here as an arrangement you copy, not a component you
// import from `@kanzo-tech/ui`. Both the app-shell showcase and the metric-card doc examples
// pull it from this one file so the composition is written once.

import type { ComponentProps } from "react";
import { Card, cn, Show, Skeleton } from "@kanzo-tech/ui";

export type MetricCardStatus = "neutral" | "success" | "warning" | "danger";

export interface MetricCardProps extends ComponentProps<"article"> {
  /** Token-backed semantic state. Default "neutral". Tints the icon disc via `data-status`. */
  status?: MetricCardStatus;
  /**
   * Makes the whole card a link. `Card` is `asChild`-swappable, so the anchor *is* the card —
   * no wrapper element, and no injected link component.
   */
  href?: string;
}

export function MetricCard({
  status = "neutral",
  href,
  className,
  children,
  ...rest
}: MetricCardProps) {
  const shell = {
    className: cn(
      "group/metric-card flex min-h-32 flex-col gap-0 rounded-lg px-5 py-4 shadow-none",
      href != null &&
        "h-full outline-none transition-colors hover:border-primary/40 focus-visible:border-primary",
      className
    ),
    "data-slot": "metric-card",
    "data-status": status,
    ...rest,
  };

  // `asChild` needs one real element, so the branch is a statement rather than a `Show`:
  // `Show` returns a Fragment, and `Children.only` would clone that instead of the anchor.
  if (href == null) return <Card {...shell}>{children}</Card>;

  return (
    <Card asChild {...shell}>
      <a href={href}>{children}</a>
    </Card>
  );
}

export function MetricCardHeader({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      data-slot="metric-card-header"
      {...rest}
    />
  );
}

export function MetricCardIcon({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground [&_svg]:size-3.5",
        "group-data-[status=success]/metric-card:bg-success/10 group-data-[status=success]/metric-card:text-success",
        "group-data-[status=warning]/metric-card:bg-warning/10 group-data-[status=warning]/metric-card:text-warning",
        "group-data-[status=danger]/metric-card:bg-destructive/10 group-data-[status=danger]/metric-card:text-destructive",
        className
      )}
      data-slot="metric-card-icon"
      {...rest}
    />
  );
}

export function MetricCardLabel({ className, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "min-w-0 truncate font-medium text-muted-foreground text-sm",
        className
      )}
      data-slot="metric-card-label"
      {...rest}
    />
  );
}

export interface MetricCardValueProps extends ComponentProps<"div"> {
  loading?: boolean;
}

export function MetricCardValue({
  loading = false,
  className,
  children,
  ...rest
}: MetricCardValueProps) {
  return (
    <div
      className={cn("flex flex-1 items-start pt-3", className)}
      data-slot="metric-card-value"
      {...rest}
    >
      <Show fallback={<Skeleton className="h-7 w-20" />} when={!loading}>
        <p className="font-semibold text-2xl leading-none tracking-tight">
          {children}
        </p>
      </Show>
    </div>
  );
}

export interface MetricCardDescriptionProps extends ComponentProps<"p"> {
  loading?: boolean;
}

export function MetricCardDescription({
  loading = false,
  className,
  children,
  ...rest
}: MetricCardDescriptionProps) {
  return (
    <p
      className={cn("pt-2 text-muted-foreground text-sm", className)}
      data-slot="metric-card-description"
      {...rest}
    >
      <Show fallback={<Skeleton className="h-4 w-28" />} when={!loading}>
        {children}
      </Show>
    </p>
  );
}
