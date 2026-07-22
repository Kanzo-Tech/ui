import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";

export interface SectionHeaderProps extends ComponentProps<"header"> {
  /** Draw a bottom separator under the header. Default false. */
  bordered?: boolean;
}

/**
 * SectionHeader — a reusable "title + description + actions" header for panels, forms and
 * sections (sourced from metadata-form's header). Renders a `<header>` landmark with a real,
 * level-configurable heading. Domain-free.
 *
 * Regions are CHILDREN, not props. They used to be four `ReactNode` attributes
 * (`title`/`description`/`actions`/`icon`), which is a layout tree written as attributes: you
 * cannot reorder it, wrap a region in a tooltip, spread props onto one, or use `asChild`.
 * Composition gives all of that back, and matches how every simple in this library already
 * works — `CardHeader`, not `<Card header={…} />`. `bordered` stays a prop: it styles the
 * header itself rather than filling a region.
 *
 *   <SectionHeader>
 *     <SectionHeaderIcon><BoxIcon/></SectionHeaderIcon>
 *     <SectionHeaderContent>
 *       <SectionHeaderTitle>Metadata</SectionHeaderTitle>
 *       <SectionHeaderDescription>…</SectionHeaderDescription>
 *     </SectionHeaderContent>
 *     <SectionHeaderActions><Button/></SectionHeaderActions>
 *   </SectionHeader>
 */
export function SectionHeader({ bordered = false, className, ...rest }: SectionHeaderProps) {
  return (
    <header
      data-slot="section-header"
      className={cn(
        "flex items-start gap-3",
        bordered && "border-b border-border pb-3",
        className,
      )}
      {...rest}
    />
  );
}
SectionHeader.displayName = "SectionHeader";

/** Leading icon or badge. `mt-0.5` optically aligns it with the title's cap height. */
export function SectionHeaderIcon({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5", className)}
      data-slot="section-header-icon"
      {...rest}
    />
  );
}
SectionHeaderIcon.displayName = "SectionHeaderIcon";

/** The text column: title over description. `min-w-0` lets the title truncate. */
export function SectionHeaderContent({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0 flex-1", className)}
      data-slot="section-header-content"
      {...rest}
    />
  );
}
SectionHeaderContent.displayName = "SectionHeaderContent";

export interface SectionHeaderTitleProps extends Omit<ComponentProps<"h2">, "ref"> {
  /** Heading level, so the title slots into the surrounding outline. Default 2. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function SectionHeaderTitle({
  level = 2,
  className,
  ...rest
}: SectionHeaderTitleProps) {
  const Title = `h${level}` as const;
  return (
    <Title
      className={cn("truncate text-lg font-semibold text-foreground", className)}
      data-slot="section-header-title"
      {...rest}
    />
  );
}
SectionHeaderTitle.displayName = "SectionHeaderTitle";

export function SectionHeaderDescription({ className, ...rest }: ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-0.5 text-sm text-muted-foreground", className)}
      data-slot="section-header-description"
      {...rest}
    />
  );
}
SectionHeaderDescription.displayName = "SectionHeaderDescription";

/**
 * End-aligned controls. `ms-auto` replaces the root's old `justify-between`: with an optional
 * icon and text column ahead of it, one logical margin pushes the actions to the inline end
 * and still mirrors in RTL.
 */
export function SectionHeaderActions({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("ms-auto flex shrink-0 items-center gap-2", className)}
      data-slot="section-header-actions"
      {...rest}
    />
  );
}
SectionHeaderActions.displayName = "SectionHeaderActions";
