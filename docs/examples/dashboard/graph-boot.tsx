"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { engine, type Engine } from "@kanzo-tech/mosaic/engine";
import { MosaicProvider } from "@kanzo-tech/ui/analytics";
import { Skeleton } from "@kanzo-tech/ui";
import { attachWritten } from "@/lib/attach-graph";
import type { ExampleGraph } from "./graph-demo";

// The page's one engine, and each graph attached to it once: `engine()` is memoised per document, so
// every example on the page reads the same database, and each `MosaicProvider` still gets its own
// selection, so one example's brush never reaches into the next.
const attaching = new Map<ExampleGraph, Promise<{ engine: Engine; graph: Graph }>>();

function attach(name: ExampleGraph) {
  let pending = attaching.get(name);
  if (!pending) {
    const base = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus/${name}`;
    pending = engine().then(async (e) => ({ engine: e, graph: await attachWritten(e, name, base) }));
    attaching.set(name, pending);
    // A failed attach is forgotten, so the next example tries again instead of inheriting it.
    pending.catch(() => attaching.delete(name));
  }
  return pending;
}

export default function GraphBoot({ name, children }: { name: ExampleGraph; children: ReactNode }) {
  const [attached, setAttached] = useState<{ engine: Engine; graph: Graph } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    attach(name).then(
      (a) => live && setAttached(a),
      (error: unknown) => live && setFailure(error),
    );
    return () => {
      live = false;
    };
  }, [name]);

  if (failure !== null) return <p className="text-muted-foreground text-sm">{failure instanceof Error ? failure.message : String(failure)}</p>;
  if (!attached) return <Skeleton className="h-96 w-full" />;
  return (
    <MosaicProvider engine={attached.engine} graph={attached.graph}>
      {children}
    </MosaicProvider>
  );
}
