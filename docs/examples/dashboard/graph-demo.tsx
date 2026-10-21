"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { Skeleton } from "@kanzo-tech/ui";

/**
 * The two graphs the dashboard pages read, written by fossil's writer at build time
 * (`corpus/build.mjs`): the sightings, one `Sighting` per report, and the archive's closed contracts,
 * one `Contract` each with a GraphAr `date`, `closed`.
 */
export type ExampleGraph = "sightings" | "contracts";

/** Every sighting, as the pattern a dashboard reads: its fields are `sighting.beast`, `sighting.hour`, … */
export const SIGHTINGS: Pattern = [{ as: "sighting", type: "Sighting" }];

/** Every closed contract: `contract.closed`, `contract.region`, … and `contract.subject`, its key. */
export const CONTRACTS: Pattern = [{ as: "contract", type: "Contract" }];

// DuckDB-WASM is browser-only, so the boot island is loaded with `ssr: false`: the RSC prerender
// renders the skeleton and never evaluates the analytics stack.
const GraphBoot = dynamic(() => import("./graph-boot"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});

/** A `MosaicProvider` over the page's engine and the graph `name`, attached once for the page. */
export function GraphDemo({ name, children }: { name: ExampleGraph; children: ReactNode }) {
  return <GraphBoot name={name}>{children}</GraphBoot>;
}
