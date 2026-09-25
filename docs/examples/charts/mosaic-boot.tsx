"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MosaicProvider, engine, loadObjects, type Coordinator } from "@kanzo-tech/ui/analytics";
import { Skeleton } from "@kanzo-tech/ui";
import { SIGHTINGS_TABLE, sightingRows } from "@/example/sightings";

// The page's one engine, from `engine()`, and the sample table loaded into it once. `engine()` is
// memoised per document, which is what lets every example below share one database; each
// `MosaicProvider` still gets its own pair of `Selection`s, so one example's brush never reaches
// into the next.
let loading: Promise<Coordinator> | null = null;

function boot(): Promise<Coordinator> {
  loading ??= (async () => {
    const { coordinator } = await engine();
    await coordinator.exec(loadObjects(SIGHTINGS_TABLE, sightingRows()));
    return coordinator;
  })();
  return loading;
}

export default function MosaicBoot({ children }: { children: ReactNode }) {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);

  useEffect(() => {
    let live = true;
    boot().then((instance) => {
      if (live) setCoordinator(instance);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!coordinator) return <Skeleton className="h-40 w-full max-w-2xl" />;

  return <MosaicProvider coordinator={coordinator}>{children}</MosaicProvider>;
}
