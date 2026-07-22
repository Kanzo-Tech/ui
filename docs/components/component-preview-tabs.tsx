"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@kanzo-tech/ui";

interface ComponentPreviewTabsProps {
  component: ReactNode;
  source: ReactNode;
  fullBleed?: boolean;
  hasMaxHeight?: boolean;
  showBorders?: boolean;
}

/**
 * Preview | Code, matching Shark UI's docs exactly.
 *
 * Tabs rather than a "show code" disclosure: Shark reserves the collapsible for the full
 * component source in its install step, and uses tabs for examples. Both panes are a fixed
 * 450px so switching does not shift the page under the reader.
 *
 * The backdrop is four dashed 1px guides inset from each edge — Shark's padding guides — not
 * a dot grid. `inset-s-*` / `inset-e-*` are logical, so it mirrors correctly in RTL.
 *
 * `fullBleed` drops all of that — frame, padding, centring and height cap — for components the
 * frame actively hides: a shell, a workspace, a panel. Those examples bring their own container,
 * so the outer border moves to the code pane rather than doubling up around theirs.
 */
export const ComponentPreviewTabs = ({
  component,
  source,
  fullBleed = false,
  hasMaxHeight = true,
  showBorders = true,
}: ComponentPreviewTabsProps) => (
  <Tabs defaultValue="preview" className="group relative mt-4 mb-12 flex flex-col gap-2">
    <TabsList>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
    </TabsList>

    <div className={cn("relative overflow-hidden rounded-2xl", !fullBleed && "border")}>
      <TabsContent data-slot="tab-preview" value="preview">
        <div
          className={cn(
            // `not-prose` is load-bearing, not hygiene. The preview renders inside the MDX
            // prose container, so without it fumadocs' typography styles reach INTO the
            // rendered component: `<ul>` gets `list-style: disc`, links get underlines,
            // headings get margins. That is where the unexplained bullet down the left of
            // the Sidebar examples came from — `SidebarMenu` is a `<ul>`, byte-identical to
            // Shark's, and the dot was never part of the component at all.
            "not-prose",
            hasMaxHeight && "h-[450px]",
            "relative w-full",
            !fullBleed && "flex items-center justify-center overflow-y-auto p-4 sm:p-10",
          )}
          data-slot="preview"
          data-full-bleed={fullBleed || undefined}
        >
          {showBorders && (
            <>
              <div className="absolute inset-x-0 top-4 border border-border/64 border-dashed max-sm:hidden sm:top-8" />
              <div className="absolute inset-x-0 bottom-4 border border-border/64 border-dashed max-sm:hidden sm:bottom-8" />
              <div className="absolute inset-s-4 inset-y-0 border border-border/64 border-dashed max-sm:hidden sm:inset-s-8" />
              <div className="absolute inset-e-4 inset-y-0 border border-border/64 border-dashed max-sm:hidden sm:inset-e-8" />
            </>
          )}
          {component}
        </div>
      </TabsContent>

      <TabsContent data-slot="tab-code" value="code">
        <div
          className={cn(
            "overflow-hidden **:[figure]:m-0! **:[figure]:border-0 **:[pre]:h-[450px]",
            !hasMaxHeight && "min-h-[450px]",
            fullBleed && "rounded-2xl border",
          )}
          data-slot="code"
        >
          {source}
        </div>
      </TabsContent>
    </div>
  </Tabs>
);
