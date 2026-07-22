import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";

/**
 * PageShell — the "page header + body + footer" pattern every product repeats. Domain-free,
 * token-styled (was keasy's Tailwind `layout/page-shell.tsx`).
 *
 *   <PageShell>
 *     <PageShellHeader>
 *       <PageShellTitle>Catalog</PageShellTitle>
 *       <PageShellDescription>…</PageShellDescription>
 *       <PageShellActions><Button/></PageShellActions>
 *     </PageShellHeader>
 *     <PageShellContent> … </PageShellContent>
 *     <PageShellFooter> … </PageShellFooter>
 *   </PageShell>
 *
 * The header's regions are CHILDREN, not props. They used to be `title`/`description`/
 * `actions` `ReactNode` attributes, which is a layout tree written as attributes: you cannot
 * reorder it, wrap a region, spread props onto one, or use `asChild`.
 *
 * The parts are FLAT exports, not `Object.assign(PageShell, { Header })`. Statics are lost
 * when a module becomes a client reference under React Server Components, so `PageShell.Header`
 * reads back as `undefined` there — a bug we hit for real with `Preferences`.
 */
export function PageShell({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      data-slot="page-shell"
      {...rest}
    />
  );
}
PageShell.displayName = "PageShell";

/**
 * A two-column grid rather than a flex row: it lets the title and description stack in the
 * first column with no wrapper element around them, while `PageShellActions` spans both rows
 * in the second (see its own placement classes).
 */
export function PageShellHeader({ className, ...rest }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "grid auto-rows-min grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 pb-2 pt-4",
        className,
      )}
      data-slot="page-shell-header"
      {...rest}
    />
  );
}
PageShellHeader.displayName = "PageShellHeader";

export function PageShellTitle({ className, ...rest }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn("col-start-1 text-lg font-bold text-foreground", className)}
      data-slot="page-shell-title"
      {...rest}
    />
  );
}
PageShellTitle.displayName = "PageShellTitle";

export function PageShellDescription({ className, ...rest }: ComponentProps<"p">) {
  return (
    <p
      className={cn("col-start-1 mt-1 text-sm text-muted-foreground", className)}
      data-slot="page-shell-description"
      {...rest}
    />
  );
}
PageShellDescription.displayName = "PageShellDescription";

/** End-aligned header controls. Spans both header rows so it centres against the whole block. */
export function PageShellActions({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end",
        className,
      )}
      data-slot="page-shell-actions"
      {...rest}
    />
  );
}
PageShellActions.displayName = "PageShellActions";

/**
 * `<section>` (not `<main>`) so PageShell can safely nest inside an AppShell that already
 * owns the page's single `<main>` landmark.
 */
export function PageShellContent({ className, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4", className)}
      data-slot="page-shell-content"
      {...rest}
    />
  );
}
PageShellContent.displayName = "PageShellContent";

export function PageShellFooter({ className, children, ...rest }: ComponentProps<"footer">) {
  return (
    <footer
      className={cn("shrink-0 border-t border-border bg-card px-4 py-3", className)}
      data-slot="page-shell-footer"
      {...rest}
    >
      <div className="flex items-center justify-between">{children}</div>
    </footer>
  );
}
PageShellFooter.displayName = "PageShellFooter";
