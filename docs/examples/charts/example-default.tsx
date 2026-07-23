"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@kanzo-tech/ui";

// DuckDB-WASM is browser-only, and the Mosaic/vgplot module tree must never be evaluated during
// the RSC prerender. So the crossfilter island is loaded with `ssr: false`: this file — the one
// the server renders — imports nothing from the analytics stack. The RSC page prerenders the
// `loading` skeleton below, and the real chart (which boots DuckDB and renders the crossfiltered
// Histogram + BarChart) hydrates in the browser. That boundary is the whole point of the /charts
// subpath's bring-your-own-coordinator shape.
const CrossfilterDemo = dynamic(() => import("./crossfilter-demo"), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  ),
});

export default function Example() {
  return <CrossfilterDemo />;
}
