import type { ReactNode } from "react";

/** The IDE-style shell: a fixed top bar over a full-height workspace whose regions
 *  (left aside · main · right aside) each scroll on their own. Domain-free — the caller
 *  passes each region as a slot (typically a {@link TopBar} and {@link SidePanel}s). */
export function AppShell({
  topBar,
  left,
  right,
  children,
}: {
  topBar?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** The primary content (`<main>`). */
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {topBar}
      <div className="relative flex min-h-0 flex-1">
        {left}
        <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
        {right}
      </div>
    </div>
  );
}
