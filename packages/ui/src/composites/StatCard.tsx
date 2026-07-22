import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Card } from "../simples/card.js";
import { Skeleton } from "../simples/skeleton.js";
import { DefaultLink, type LinkComponent } from "./link.js";

export type StatCardStatus = "neutral" | "success" | "warning" | "danger";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  /** Pre-rendered icon, shown in a tinted disc that carries the status colour. */
  icon?: ReactNode;
  /** Token-backed semantic state. Default "neutral". */
  status?: StatCardStatus;
  /** Explicit — never infer loading from an undefined value. */
  loading?: boolean;
  /** Makes the whole card a link. Omit for a plain, non-navigating surface. */
  href?: string;
  linkComponent?: LinkComponent;
  className?: string;
}

const statusDisc: Record<StatCardStatus, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * A single headline figure with its label, an optional status tint and an optional
 * description — the tile a dashboard is built from.
 *
 * Navigation is opt-in: with `href` the whole card becomes one link target (a single tab
 * stop, which is what a tile should be), without it the card is inert.
 */
export function StatCard({
  label,
  value,
  description,
  icon,
  status = "neutral",
  loading = false,
  href,
  linkComponent: Link = DefaultLink,
  className,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        // Flex, not a 3-row grid: with a grid the figure sat in a `1fr` row whose height
        // depended on whether a description existed and how many lines it ran to, so a
        // one-line tile centred differently from a two-line one. Here the figure block
        // grows and centres its own content, and the description is measured out of it.
        "flex h-full flex-col gap-0 rounded-lg px-5 py-4 shadow-none",
        href != null &&
          "transition-colors group-hover/stat:border-primary/40 group-focus-visible/stat:border-primary",
        className
      )}
      data-slot="stat-card"
      data-status={status}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon != null && (
          <div
            className={cn(
              "shrink-0 rounded-full p-1.5 [&_svg]:size-3.5",
              statusDisc[status]
            )}
          >
            {icon}
          </div>
        )}
        <span className="min-w-0 truncate font-medium text-muted-foreground text-sm">
          {label}
        </span>
      </div>

      <div className="flex flex-1 items-start pt-3">
        {loading ? (
          // Sized to the rendered figure so the tile does not jump when it resolves.
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="font-semibold text-2xl leading-none tracking-tight">
            {value}
          </p>
        )}
      </div>

      {description != null && (
        <p className="pt-2 text-muted-foreground text-sm">{description}</p>
      )}
    </Card>
  );

  if (href == null) return card;

  return (
    <Link
      className="group/stat block h-full rounded-lg outline-none"
      href={href}
    >
      {card}
    </Link>
  );
}
StatCard.displayName = "StatCard";
