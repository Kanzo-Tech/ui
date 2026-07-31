"use client";

import { AppearanceToggle, ClientOnly, Show, Skeleton, useKanzoTheme } from "@kanzo-tech/ui";

// The preference is browser state, so the readout is held back until mount — the same reason the
// toggle withholds its own state-bearing attributes on the server.
function Readout() {
  const { appearance, resolvedAppearance } = useKanzoTheme();

  return (
    <p className="text-muted-foreground text-sm">
      <Show fallback={<>Pinned to {appearance}.</>} when={appearance === null}>
        Following the OS — resolved to {resolvedAppearance}.
      </Show>
    </p>
  );
}

export default function Example() {
  return (
    <div className="flex flex-col items-center gap-4">
      <AppearanceToggle variant="outline" />
      <ClientOnly fallback={<Skeleton className="h-5 w-52" />}>
        <Readout />
      </ClientOnly>
    </div>
  );
}
