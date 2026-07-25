"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@kanzo-tech/ui";

// DuckDB-WASM is browser-only, so the boot island is loaded with `ssr: false`: the RSC prerender
// renders the skeleton and never evaluates the analytics stack. Every example on the page wraps
// its charts in this, and they all share the one coordinator it holds.
const MosaicBoot = dynamic(() => import("./mosaic-boot"), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full max-w-2xl" />,
});

export interface MosaicDemoProps {
  children: ReactNode;
}

export function MosaicDemo({ children }: MosaicDemoProps) {
  return <MosaicBoot>{children}</MosaicBoot>;
}
