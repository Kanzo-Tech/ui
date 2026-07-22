import type { ReactNode } from "react";

/** The app chrome: an optional low-key utility strip over the title bar
 *  (title/subtitle + a spacer + right-aligned actions). Pure layout — every region is a
 *  slot, so it stays domain-free. */
export function TopBar({
  title,
  subtitle,
  actions,
  utility,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned controls in the title bar. */
  actions?: ReactNode;
  /** A low-key strip above the title bar (e.g. pickers, attribution). */
  utility?: ReactNode;
}) {
  return (
    <header>
      {utility != null && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-5 py-1">
          {utility}
        </div>
      )}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        {(title != null || subtitle != null) && (
          <div className="mr-2 flex flex-col">
            {title != null && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {subtitle != null && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
        <div className="flex-1" />
        {actions}
      </div>
    </header>
  );
}
