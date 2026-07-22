import type { CSSProperties, ReactNode } from "react";

/**
 * PageShell — the "page header + body + footer" pattern every product repeats.
 * Domain-free: title/description/actions are slots. Token-styled (was keasy's Tailwind
 * `layout/page-shell.tsx`).
 *
 *   <PageShell>
 *     <PageShell.Header title="Catalog" description="…" actions={<Button/>} />
 *     <PageShell.Content> … </PageShell.Content>
 *     <PageShell.Footer> … </PageShell.Footer>
 *   </PageShell>
 */
function PageShellRoot({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={style}>
      {children}
    </div>
  );
}

function Header({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-4 pb-2 pt-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {description != null && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

// `<section>` (not `<main>`) so PageShell can safely nest inside an AppShell that already
// owns the page's single `<main>` landmark.
function Content({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4" style={style}>
      {children}
    </section>
  );
}

function Footer({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <footer className="shrink-0 border-t border-border bg-card px-4 py-3" style={style}>
      <div className="flex items-center justify-between">{children}</div>
    </footer>
  );
}

export const PageShell = Object.assign(PageShellRoot, { Header, Content, Footer });
