import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";
import { Card } from "../simples/card.js";
import { Skeleton } from "../simples/skeleton.js";
import { DefaultLink, type LinkComponent } from "./link.js";

export type StatCardStatus = "neutral" | "success" | "warning" | "danger";

export interface StatCardProps extends ComponentProps<"div"> {
  /** Token-backed semantic state. Default "neutral". Tints the icon disc via `data-status`. */
  status?: StatCardStatus;
  /** Makes the whole card a link. Omit for a plain, non-navigating surface. */
  href?: string;
  linkComponent?: LinkComponent;
}

/**
 * StatCard — a single headline figure with its label, an optional status tint and an optional
 * description: the tile a dashboard is built from.
 *
 * Navigation is opt-in: with `href` the whole card becomes one link target (a single tab
 * stop, which is what a tile should be), without it the card is inert.
 *
 * Regions are CHILDREN, not props. They used to be four `ReactNode` attributes
 * (`label`/`value`/`description`/`icon`), which is a layout tree written as attributes: you
 * cannot reorder it, wrap a region in a tooltip, spread props onto one, or use `asChild`.
 * Composition gives all of that back, and matches how every simple in this library already
 * works — `CardHeader`, not `<Card header={…} />`. `status`, `href` and `linkComponent` stay
 * props: they are state and behaviour, not content. `loading` moved to the parts that
 * actually swap for a skeleton ({@link StatCardValue}, {@link StatCardDescription}).
 *
 *   <StatCard status="success" href="/jobs">
 *     <StatCardHeader>
 *       <StatCardIcon><CheckIcon/></StatCardIcon>
 *       <StatCardLabel>Completed</StatCardLabel>
 *     </StatCardHeader>
 *     <StatCardValue loading={pending}>1,204</StatCardValue>
 *     <StatCardDescription>in the last 24h</StatCardDescription>
 *   </StatCard>
 */
export function StatCard({
  status = "neutral",
  href,
  linkComponent: Link = DefaultLink,
  className,
  ...rest
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        // Flex, not a 3-row grid: with a grid the figure sat in a `1fr` row whose height
        // depended on whether a description existed and how many lines it ran to, so a
        // one-line tile centred differently from a two-line one. Here the figure block
        // grows and centres its own content, and the description is measured out of it.
        //
        // `min-h-32`, NOT `h-full`. A row of tiles has to line up even when one of them
        // has no description, and `h-full` cannot deliver that: it is a percentage of the
        // parent, so it is redundant inside a grid (grid items already stretch) and wrong
        // everywhere else — in a centred flex container it inflated a 122px tile to the
        // full height of the container. The floor sits just above the natural height of a
        // full tile (icon row + figure + one description line), so `StatCardValue`'s
        // `flex-1` absorbs the slack on the short ones and every figure lands on the same
        // baseline.
        "group/stat-card flex min-h-32 flex-col gap-0 rounded-lg px-5 py-4 shadow-none",
        href != null &&
          // Only inside the link wrapper: there the anchor is the grid item that stretches,
          // and the card has to fill it. The anchor is height-auto otherwise, so this
          // resolves to auto and cannot inflate a standalone tile.
          "h-full transition-colors group-hover/stat:border-primary/40 group-focus-visible/stat:border-primary",
        className
      )}
      data-slot="stat-card"
      data-status={status}
      {...rest}
    />
  );

  if (href == null) return card;

  return (
    <Link
      // No `h-full` here either — as a grid item the anchor stretches on its own, and
      // anywhere else the percentage resolved against the container and blew the tile up.
      className="group/stat block rounded-lg outline-none"
      href={href}
    >
      {card}
    </Link>
  );
}
StatCard.displayName = "StatCard";

/** The icon + label row above the figure. */
export function StatCardHeader({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      data-slot="stat-card-header"
      {...rest}
    />
  );
}
StatCardHeader.displayName = "StatCardHeader";

/**
 * The tinted disc that carries the status colour. The tint is read off the root's
 * `data-status` rather than passed down, so the status stays a single prop on the card and
 * this part needs no context (and no `"use client"`).
 */
export function StatCardIcon({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground [&_svg]:size-3.5",
        "group-data-[status=success]/stat-card:bg-success/10 group-data-[status=success]/stat-card:text-success",
        "group-data-[status=warning]/stat-card:bg-warning/10 group-data-[status=warning]/stat-card:text-warning",
        "group-data-[status=danger]/stat-card:bg-destructive/10 group-data-[status=danger]/stat-card:text-destructive",
        className
      )}
      data-slot="stat-card-icon"
      {...rest}
    />
  );
}
StatCardIcon.displayName = "StatCardIcon";

export function StatCardLabel({ className, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cn("min-w-0 truncate font-medium text-muted-foreground text-sm", className)}
      data-slot="stat-card-label"
      {...rest}
    />
  );
}
StatCardLabel.displayName = "StatCardLabel";

export interface StatCardValueProps extends ComponentProps<"div"> {
  /** Explicit — never infer loading from an undefined value. */
  loading?: boolean;
}

/** The headline figure. Grows to fill the tile so one- and two-line cards align. */
export function StatCardValue({ loading = false, className, children, ...rest }: StatCardValueProps) {
  return (
    <div
      className={cn("flex flex-1 items-start pt-3", className)}
      data-slot="stat-card-value"
      {...rest}
    >
      {loading ? (
        // Sized to the rendered figure so the tile does not jump when it resolves.
        <Skeleton className="h-7 w-20" />
      ) : (
        <p className="font-semibold text-2xl leading-none tracking-tight">{children}</p>
      )}
    </div>
  );
}
StatCardValue.displayName = "StatCardValue";

export interface StatCardDescriptionProps extends ComponentProps<"p"> {
  loading?: boolean;
}

export function StatCardDescription({
  loading = false,
  className,
  children,
  ...rest
}: StatCardDescriptionProps) {
  return (
    <p
      className={cn("pt-2 text-muted-foreground text-sm", className)}
      data-slot="stat-card-description"
      {...rest}
    >
      {loading ? <Skeleton className="h-4 w-28" /> : children}
    </p>
  );
}
StatCardDescription.displayName = "StatCardDescription";
