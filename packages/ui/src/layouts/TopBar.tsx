import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";

/**
 * TopBar — the app chrome: an optional low-key utility strip over the title bar
 * (title/subtitle + right-aligned actions). Pure layout, domain-free.
 *
 * Regions are CHILDREN, not props. They used to be four `ReactNode` attributes
 * (`title`/`subtitle`/`actions`/`utility`), which is a layout tree written as attributes: you
 * cannot reorder it, wrap a region, spread props onto one, or use `asChild`. Composition
 * gives all of that back, and matches how every simple in this library already works —
 * `CardHeader`, not `<Card header={…} />`.
 *
 *   <TopBar>
 *     <TopBarUtility>…</TopBarUtility>
 *     <TopBarMain>
 *       <TopBarTitleGroup>
 *         <TopBarTitle>Catalog</TopBarTitle>
 *         <TopBarSubtitle>12 items</TopBarSubtitle>
 *       </TopBarTitleGroup>
 *       <TopBarActions><Button/></TopBarActions>
 *     </TopBarMain>
 *   </TopBar>
 */
export function TopBar({ className, ...rest }: ComponentProps<"header">) {
  return <header className={cn(className)} data-slot="top-bar" {...rest} />;
}
TopBar.displayName = "TopBar";

/** The low-key strip above the title bar (e.g. pickers, attribution). */
export function TopBarUtility({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-5 py-1",
        className,
      )}
      data-slot="top-bar-utility"
      {...rest}
    />
  );
}
TopBarUtility.displayName = "TopBarUtility";

/** The title bar row itself: headings at the start, actions pushed to the end. */
export function TopBarMain({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3",
        className,
      )}
      data-slot="top-bar-main"
      {...rest}
    />
  );
}
TopBarMain.displayName = "TopBarMain";

/** Stacks the title over its subtitle as one block, so the row's `gap` applies around them. */
export function TopBarTitleGroup({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("me-2 flex min-w-0 flex-col", className)}
      data-slot="top-bar-title-group"
      {...rest}
    />
  );
}
TopBarTitleGroup.displayName = "TopBarTitleGroup";

export function TopBarTitle({ className, ...rest }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      data-slot="top-bar-title"
      {...rest}
    />
  );
}
TopBarTitle.displayName = "TopBarTitle";

export function TopBarSubtitle({ className, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-xs text-muted-foreground", className)}
      data-slot="top-bar-subtitle"
      {...rest}
    />
  );
}
TopBarSubtitle.displayName = "TopBarSubtitle";

/**
 * End-aligned controls. `ms-auto` replaces the old `flex-1` spacer div: one logical margin
 * instead of an empty element, so it mirrors correctly in RTL.
 */
export function TopBarActions({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("ms-auto flex items-center gap-2", className)}
      data-slot="top-bar-actions"
      {...rest}
    />
  );
}
TopBarActions.displayName = "TopBarActions";
