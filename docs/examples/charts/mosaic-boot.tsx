"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadObjects } from "@kanzo-tech/mosaic";
import { engine, type Engine } from "@kanzo-tech/mosaic/engine";
import { type JoinGraph } from "@kanzo-tech/relations";
import { MosaicProvider } from "@kanzo-tech/ui/analytics";
import { Skeleton } from "@kanzo-tech/ui";
import { SIGHTINGS_TABLE, sightingRows } from "@/example/sightings";

// The page's one engine, from `engine()`, and the sample table loaded into it once. `engine()` is
// memoised per document, which is what lets every example below share one database; each
// `MosaicProvider` still gets its own pair of `Selection`s, so one example's brush never reaches
// into the next.
let loading: Promise<Engine> | null = null;

function boot(): Promise<Engine> {
  loading ??= (async () => {
    const e = await engine();
    await e.query(String(loadObjects(SIGHTINGS_TABLE, sightingRows())), { signal: new AbortController().signal });
    return e;
  })();
  return loading;
}

export default function MosaicBoot({ children, joins }: { children: ReactNode; joins?: JoinGraph }) {
  const [booted, setBooted] = useState<Engine | null>(null);

  useEffect(() => {
    let live = true;
    boot().then((instance) => {
      if (live) setBooted(instance);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!booted) return <Skeleton className="h-40 w-full max-w-2xl" />;

  return (
    <MosaicProvider engine={booted} joins={joins}>
      {children}
    </MosaicProvider>
  );
}
