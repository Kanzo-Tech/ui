"use client";

import { ClientOnly, Skeleton } from "@kanzo-tech/ui";

// Reads `window`, which does not exist during SSR — ClientOnly holds it back until mount.
function ViewportWidth() {
  return (
    <p className="text-muted-foreground text-sm">
      Viewport width:{" "}
      <span className="font-mono text-foreground">{window.innerWidth}px</span>
    </p>
  );
}

export default function Example() {
  return (
    <ClientOnly fallback={<Skeleton className="h-5 w-48" />}>
      <ViewportWidth />
    </ClientOnly>
  );
}
