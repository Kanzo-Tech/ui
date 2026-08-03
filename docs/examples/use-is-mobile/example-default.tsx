"use client";

import { Badge, Show, SidebarProvider, useSidebar } from "@kanzo-tech/ui";

// `SidebarProvider` calls `useIsMobile()` and puts the result on its context, so `isMobile` here
// is that hook's value — the one export that surfaces it today.
function Readout() {
  const { isMobile } = useSidebar();

  return (
    <div className="flex flex-col items-center gap-3">
      <Badge size="lg" variant="secondary">
        isMobile: {String(isMobile)}
      </Badge>

      <p className="max-w-xs text-center text-muted-foreground text-sm">
        <Show
          fallback={<>The viewport is 768px or wider.</>}
          when={isMobile}
        >
          The viewport is under 768px.
        </Show>{" "}
        Resize the browser window — not the preview frame — and this flips.
      </p>
    </div>
  );
}

export default function Example() {
  return (
    <SidebarProvider className="min-h-0 w-auto">
      <Readout />
    </SidebarProvider>
  );
}
