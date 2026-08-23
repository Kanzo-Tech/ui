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
  /**
   * `componentName/fileName`, written to `data-example` on the preview pane — but ONLY for the
   * examples whose height is up for measurement. `scripts/measure-previews.mjs` selects on it, so
   * an example that declares its own `height` deliberately carries no key and is never overwritten.
   */
  measureKey?: string;
  showBorders?: boolean;
}

/**
 * Preview | Code, taken from Shark UI's docs with two deliberate differences.
 *
 * Tabs rather than a "show code" disclosure: Shark reserves the collapsible for the full
 * component source in its install step, and uses tabs for examples.
 *
 * **`height` is per example, not a constant**, and both panes share it — so switching still never
 * shifts the page, which is what Shark's constant was for, without spending 73 % of a five-line
 * example on emptiness. `component-preview.tsx` derives it and states the measurement.
 *
 * The backdrop is four dashed 1px guides marking the padding box. `inset-s-*` / `inset-e-*` are
 * logical, so it mirrors correctly in RTL. **They sit at the padding, and upstream's do not** —
 * Shark writes `p-4 sm:p-10` with guides at `top-4 sm:top-10`, so above the `sm` breakpoint the
 * lines land 8px inside the padding they are drawn to show, and below it the guides are hidden
 * anyway. Ours are `sm:*-10` against the same `sm:p-10`. Measured 2026-08-20: padding 40px, guides
 * were at 32px. It is a docs app rather than the registry, so `shark-parity.test.ts` has no opinion
 * either way; the divergence is here so the comment above can be true.
 *
 * `fullBleed` drops all of that — frame, padding, centring and height — for components the frame
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
  showBorders = true,
}: ComponentPreviewTabsProps) => {
  const { paneRef, cue, halt } = usePreviewAutoplay(autoplay);

  return (
  <Tabs defaultValue="preview" className="group relative mt-4 mb-12 flex flex-col gap-2">
    <TabsList>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
    </TabsList>

    <div className={cn("relative overflow-hidden rounded-2xl", !fullBleed && "border")}>
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
            !fullBleed && "flex items-center justify-center overflow-y-auto p-4 sm:p-10",
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
          {showBorders && (
            <>
              <div className="absolute inset-x-0 top-4 border border-border/64 border-dashed max-sm:hidden sm:top-10" />
              <div className="absolute inset-x-0 bottom-4 border border-border/64 border-dashed max-sm:hidden sm:bottom-10" />
              <div className="absolute inset-s-4 inset-y-0 border border-border/64 border-dashed max-sm:hidden sm:inset-s-10" />
              <div className="absolute inset-e-4 inset-y-0 border border-border/64 border-dashed max-sm:hidden sm:inset-e-10" />
            </>
          )}
          <PreviewAutoplayProvider cue={cue}>{component}</PreviewAutoplayProvider>
        </div>
      </TabsContent>

      <TabsContent slot="tab-code" value="code">
        <div
          className={cn("overflow-hidden", fullBleed && "rounded-2xl border")}
          data-slot="code"
        >
          {source}
        </div>
      </TabsContent>
    </div>
  </Tabs>
  );
};
