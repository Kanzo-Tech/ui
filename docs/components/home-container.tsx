"use client";

import type { ReactNode } from "react";
import { cn } from "@kanzo-tech/ui";

/**
 * The home layout's container, as a `div` rather than fumadocs' `<main>`.
 *
 * **Why it is a `<main>` upstream and must not be one here.** `ShellMain` renders the `<main>`
 * landmark, and there is exactly one per page — the repo's one-way door. The landing page renders
 * its own, and `/theme-generator` renders a shell; under fumadocs' container both pages carried two
 * landmarks, which is an HTML conformance error and makes "skip to main content" ambiguous. The id
 * stays, because fumadocs' stylesheet selects on it for the layout width.
 *
 * **And why it is a client module.** `HomeLayout` is a client component, so a slot it receives has
 * to be something the boundary can carry: a client component reference is, a function defined in a
 * server module is not — "Functions cannot be passed directly to Client Components", at build time
 * only. The layout that renders it is a Server Component, so this cannot live beside it.
 */
export function HomeContainer(props: { className?: string; children?: ReactNode }) {
  return (
    <div
      {...props}
      className={cn("flex flex-1 flex-col [--fd-layout-width:1400px]", props.className)}
      id="nd-home-layout"
    />
  );
}

export default HomeContainer;
