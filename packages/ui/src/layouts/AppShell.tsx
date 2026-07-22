import type { ComponentProps } from "react";
import { cn } from "../lib/cn.js";

/**
 * AppShell — the IDE-style shell: a fixed top bar over a full-height workspace whose regions
 * (start aside · main · end aside) each scroll on their own. Domain-free.
 *
 * Regions are CHILDREN, not props. They used to be three `ReactNode` attributes
 * (`topBar`/`left`/`right`), which is a layout tree written as attributes: you cannot reorder
 * it, wrap a region, spread props onto one, or use `asChild`. Composition gives all of that
 * back, and matches how every simple in this library already works — `CardHeader`, not
 * `<Card header={…} />`. Because the asides are now plain children of `AppShellBody`, their
 * order is the caller's — which is also what makes the layout mirror in RTL.
 *
 *   <AppShell>
 *     <TopBar>…</TopBar>
 *     <AppShellBody>
 *       <SidePanel>…</SidePanel>
 *       <AppShellMain>…</AppShellMain>
 *       <SidePanel>…</SidePanel>
 *     </AppShellBody>
 *   </AppShell>
 */
export function AppShell({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex h-screen flex-col overflow-hidden", className)}
      data-slot="app-shell"
      {...rest}
    />
  );
}
AppShell.displayName = "AppShell";

/** The workspace row under the top bar: the asides and `AppShellMain` sit side by side here. */
export function AppShellBody({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex min-h-0 flex-1", className)}
      data-slot="app-shell-body"
      {...rest}
    />
  );
}
AppShellBody.displayName = "AppShellBody";

/** The primary content region — the page's `<main>` landmark. Scrolls on its own. */
export function AppShellMain({ className, ...rest }: ComponentProps<"main">) {
  return (
    <main
      className={cn("flex min-w-0 flex-1 flex-col overflow-auto", className)}
      data-slot="app-shell-main"
      {...rest}
    />
  );
}
AppShellMain.displayName = "AppShellMain";
