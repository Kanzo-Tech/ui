import type { CSSProperties, ReactNode } from "react";

/**
 * TwoPaneLayout — a fixed-width scrolling aside next to a flexible main column.
 * The "settings / section" shape (was keasy's `layout/sidebar-content-layout.tsx`).
 * Domain-free; both regions are slots.
 */
export interface TwoPaneLayoutProps {
  /** Left column (typically a {@link SectionNav}). */
  nav: ReactNode;
  children: ReactNode;
  /** Aside width (default `20%`, clamped 200–250px like the source). */
  asideWidth?: string;
  asideStyle?: CSSProperties;
}

export function TwoPaneLayout({ nav, children, asideWidth = "20%", asideStyle }: TwoPaneLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside
        className="shrink-0 overflow-auto"
        style={{ width: asideWidth, minWidth: 200, maxWidth: 250, ...asideStyle }}
      >
        {nav}
      </aside>
      {/* <section> (not <main>): this layout is nested by construction — it sits inside an
          AppShell / SidebarInset, which already owns the page's single <main> landmark.
          Two <main> elements are an HTML conformance error and make "skip to main content"
          ambiguous. Matches PageShell and WorkspaceLayout. */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}
