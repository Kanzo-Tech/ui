"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@kanzo-tech/ui";
import { PreviewAutoplayProvider, usePreviewAutoplay } from "@/lib/preview-autoplay";

interface ComponentPreviewTabsProps {
  component: ReactNode;
  source: ReactNode;
  /** Cue an example that has opted in, once, when the pane is half in view. */
  autoplay?: boolean;
  fullBleed?: boolean;
  /** Both panes, in px. Absent, each takes what its content needs. */
  height?: number;
  /** `componentName/fileName`, written to `data-example` on a framed preview pane, which
   *  `scripts/measure-previews.mjs` selects on. */
  measureKey?: string;
}

/**
 * Preview | Code, taken from Shark UI's docs with two deliberate differences.
 *
 * Tabs rather than a "show code" disclosure: Shark reserves the collapsible for the full
 * component source in its install step, and uses tabs for examples.
 *
 * **`height` is per example, not a constant**, and both panes share it — so switching still never
 * shifts the page, which is what Shark's constant was for, without spending 73 % of a five-line
 * example on emptiness. `lib/preview-height.mjs` is how it is chosen.
 *
 * The frame is a border and the page's own ground, with 24px of padding — Shark's dashed padding
 * guides and its 40px are gone. A guide drawn around a 36px button framed a void rather than the
 * example, and it was the frame, not the example, that a reader saw first.
 *
 * `fullBleed` drops all of that — border, padding, centring and height — for components the frame
 * actively hides: a shell, a workspace, a panel. Those examples bring their own container, so the
 * outer border moves to the code pane rather than doubling up around theirs.
 */
export const ComponentPreviewTabs = ({
  component,
  source,
  autoplay = false,
  fullBleed = false,
  height,
  measureKey,
}: ComponentPreviewTabsProps) => {
  const { paneRef, cue, halt } = usePreviewAutoplay(autoplay);

  return (
  <Tabs defaultValue="preview" className="group relative mt-4 mb-12 flex flex-col gap-2">
    <TabsList>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
    </TabsList>

    <div className={cn("relative overflow-hidden rounded-xl", !fullBleed && "border")}>
      <TabsContent slot="tab-preview" value="preview">
        <div
          className={cn(
            // `not-prose` is load-bearing, not hygiene. The preview renders inside the MDX
            // prose container, so without it fumadocs' typography styles reach INTO the
            // rendered component: `<ul>` gets `list-style: disc`, links get underlines,
            // headings get margins. That is where the unexplained bullet down the left of
            // the Sidebar examples came from — `SidebarMenu` is a `<ul>`, byte-identical to
            // Shark's, and the dot was never part of the component at all.
            "not-prose",
            "relative w-full",
            !fullBleed && "flex items-center justify-center overflow-y-auto p-4 sm:p-6",
          )}
          data-slot="preview"
          data-example={measureKey}
          data-full-bleed={fullBleed || undefined}
          // Capture, so a handler inside the example cannot swallow it first. Pointer and key
          // together are the whole surface: clicking a control and typing in a field are the two
          // ways a reader takes over, and autoplay dispatches neither, so it never halts itself.
          onKeyDownCapture={autoplay ? halt : undefined}
          onPointerDownCapture={autoplay ? halt : undefined}
          ref={autoplay ? paneRef : undefined}
          style={height ? { height } : undefined}
        >
          <PreviewAutoplayProvider cue={cue}>{component}</PreviewAutoplayProvider>
        </div>
      </TabsContent>

      <TabsContent slot="tab-code" value="code">
        <div
          className={cn("overflow-hidden", fullBleed && "rounded-xl border")}
          data-slot="code"
        >
          {source}
        </div>
      </TabsContent>
    </div>
  </Tabs>
  );
};
