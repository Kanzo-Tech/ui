"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@kanzo-tech/ui";

interface ComponentPreviewTabsProps {
  component: ReactNode;
  source: ReactNode;
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
 */
export const ComponentPreviewTabs = ({
  component,
  source,
  hasMaxHeight = true,
  showBorders = true,
}: ComponentPreviewTabsProps) => (
  <Tabs defaultValue="preview" className="group relative mt-4 mb-12 flex flex-col gap-2">
    <TabsList>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
    </TabsList>

    <div className="relative overflow-hidden rounded-2xl border">
      <TabsContent data-slot="tab-preview" value="preview">
        <div
          className={cn(
            hasMaxHeight && "h-[450px]",
            "relative w-full",
            "p-4 sm:p-10",
            "flex items-center justify-center",
            "overflow-y-auto",
          )}
          data-slot="preview"
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
          )}
          data-slot="code"
        >
          {source}
        </div>
      </TabsContent>
    </div>
  </Tabs>
);
