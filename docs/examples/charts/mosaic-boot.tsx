"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Coordinator, MosaicProvider, loadObjects, wasmConnector } from "@kanzo-tech/ui/analytics";
import { Skeleton } from "@kanzo-tech/ui";
import { telemetryRows } from "./telemetry";

// Bring-your-own-coordinator: the library never imports DuckDB. This island boots DuckDB-WASM,
// loads the sample table and owns the `Coordinator`.
//
// One coordinator for the WHOLE page, memoised at module scope. `MosaicProvider` registers its
// coordinator as vgplot's active one, and that setter is process-wide — two coordinators on one
// page and the last mounted wins, leaving the other page's charts empty. Every example below
// shares this instance; each `MosaicProvider` still gets its own pair of `Selection`s, so one
// example's brush never reaches into the next.
let booting: Promise<Coordinator> | null = null;

function boot(): Promise<Coordinator> {
  booting ??= (async () => {
    const coordinator = new Coordinator(wasmConnector());
    await coordinator.exec(loadObjects("telemetry", telemetryRows()));
    return coordinator;
  })();
  return booting;
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
