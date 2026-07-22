import type { ReactNode, Ref } from "react";
import { cn } from "../lib/cn.js";

export interface EmptyStateProps {
  /** Leading icon or illustration. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call-to-action (e.g. a Button). */
  action?: ReactNode;
  /** Heading level for the title, so it slots into the surrounding outline. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** The centered empty/zero-state placeholder used across lists and panels. */
export function EmptyState({ icon, title, description, action, headingLevel = 3, className, ref }: EmptyStateProps) {
  const Title = `h${headingLevel}` as const;
  return (
    <div ref={ref} data-slot="empty-state" className={cn("flex flex-col items-center justify-center gap-3 px-4 py-6 text-center", className)}>
      {icon != null && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <Title className="text-base font-medium text-foreground">{title}</Title>
      {description != null && <p className="max-w-[420px] text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
EmptyState.displayName = "EmptyState";
