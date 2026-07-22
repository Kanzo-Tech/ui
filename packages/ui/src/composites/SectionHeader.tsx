import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls (buttons, menus…). */
  actions?: ReactNode;
  /** Leading icon or badge. */
  icon?: ReactNode;
  /** Heading level for the title, so it slots into the surrounding outline. Default 2. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Draw a bottom separator under the header. Default false. */
  bordered?: boolean;
  className?: string;
}

/**
 * SectionHeader — a reusable "title + description + actions" header for panels, forms and
 * sections (sourced from metadata-form's header). Renders a `<header>` landmark with a real,
 * level-configurable heading. Domain-free; every region is a slot.
 */
export function SectionHeader({
  title,
  description,
  actions,
  icon,
  headingLevel = 2,
  bordered = false,
  className,
}: SectionHeaderProps) {
  const Title = `h${headingLevel}` as const;
  return (
    <header
      data-slot="section-header"
      className={cn(
        "flex items-start justify-between gap-3",
        bordered && "border-b border-border pb-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon != null && <div className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5">{icon}</div>}
        <div className="min-w-0">
          <Title className="truncate text-lg font-semibold text-foreground">{title}</Title>
          {description != null && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
SectionHeader.displayName = "SectionHeader";
