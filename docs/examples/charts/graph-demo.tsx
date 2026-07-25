"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@kanzo-tech/ui";
import type { GraphBootProps } from "./graph-boot";

// Same shape as `MosaicDemo`: DuckDB-WASM is browser-only, so the boot island is loaded with
// `ssr: false` and the RSC prerender only ever sees the skeleton.
const GraphBoot = dynamic(() => import("./graph-boot"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});

export function GraphDemo(props: GraphBootProps) {
  return <GraphBoot {...props} />;
}
