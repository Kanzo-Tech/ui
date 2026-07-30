import { ark } from "@ark-ui/react/factory";
import type { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Shell — the generic layout vocabulary.
 *
 * The library ships composable parts, not named arrangements. `AppShell`, `WorkspaceLayout`
 * and friends were each a specific shape extracted from one product, which is why the layer
 * read as "the metadata view" rather than as a design system. Those arrangements live in
 * `docs/blocks/` as showcases now; what is shipped is the vocabulary they are built from.
 *
 * Parts are exported FLAT (`ShellHeader`, not `Shell.Header`). A namespace object built with
 * `Object.assign` does not survive the RSC client boundary — `Preferences` learned that the
 * hard way, and its compound statics had to be re-exported flat.
 */

// ── Header / Footer ──────────────────────────────────────────────────────────

/**
 * The regions above and below the body. STRUCTURAL ONLY — placement, and the border that
 * separates the region from its neighbour. No height, no surface, no typography, no font
 * size: whatever you put inside is yours.
 *
 * This is deliberate and was arrived at the hard way. `Toolbar`, `StatusBar` and
 * `TopBarUtility` were three copies of one strip, and the first attempt merged them into a
 * generic `ShellBar` that kept `h-8`, `bg-card`, `text-muted-foreground` and an 11px font —
 * the IDE aesthetic of `Toolbar`, the component that had been explicitly rejected.
 * Generalising an implementation while preserving a rejected appearance is not generalising.
 *
 * So a dense IDE strip is not a component here; it is something you PUT in this region, and
 * it lives in the workspace showcase. See DESIGN.md, "The layout layer".
 *
 * No role is declared. A top region is often `banner` and a bottom one `contentinfo`, but a
 * strip is neither and a shell may have several — the call site passes the landmark.
 */
export function ShellHeader({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 flex-col border-b border-border", className)}
      {...rest}
      data-slot={slot ?? "shell-header"}
    />
  );
}
ShellHeader.displayName = "ShellHeader";

/** The region below the body. Structural only — see {@link ShellHeader}. */
export function ShellFooter({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 flex-col border-t border-border", className)}
      {...rest}
      data-slot={slot ?? "shell-footer"}
    />
  );
}
ShellFooter.displayName = "ShellFooter";

// ── Root ─────────────────────────────────────────────────────────────────────

/**
 * The outermost region: a full-height column that bars and the body stack inside.
 *
 * `h-dvh` rather than `h-screen`: on mobile browsers `100vh` includes the retracting URL bar,
 * so a shell sized with it is taller than the visible viewport and its bottom bar sits off
 * screen. `min-h-0` is what lets the body shrink and its own regions scroll instead of the
 * page growing.
 */
export function ShellRoot({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex h-dvh min-h-0 flex-col overflow-hidden", className)}
      {...rest}
      data-slot={slot ?? "shell-root"}
    />
  );
}
ShellRoot.displayName = "ShellRoot";

/** The horizontal band between the bars: asides and main sit here as siblings, in the order
 *  the caller writes them — which is also what makes the layout mirror correctly in RTL. */
export function ShellBody({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("relative flex min-h-0 flex-1", className)}
      {...rest}
      data-slot={slot ?? "shell-body"}
    />
  );
}
ShellBody.displayName = "ShellBody";

/**
 * The primary content region. Renders the `<main>` landmark.
 *
 * EXACTLY ONE per page. Two `<main>` elements are an HTML conformance error and make
 * "skip to main content" ambiguous, so nothing nested inside may render another — nestable
 * containers use `<section>`.
 */
export function ShellMain({ className, slot, ...rest }: ComponentProps<typeof ark.main>) {
  return (
    <ark.main
      className={cn("flex min-w-0 flex-1 flex-col overflow-auto", className)}
      {...rest}
      data-slot={slot ?? "shell-main"}
    />
  );
}
ShellMain.displayName = "ShellMain";

// ── Aside ────────────────────────────────────────────────────────────────────

const shellAsideVariants = tv({
  base: "flex flex-col bg-card",
  variants: {
    side: { start: "", end: "" },
    /** Docked (false) sits in the flow and carries the divider. Overlay (true) floats over
     *  the content — a narrow-viewport drawer — so it has no divider. */
    overlay: {
      true: "absolute inset-0 z-5",
      false: "min-w-0 shrink-0",
    },
  },
  compoundVariants: [
    // The divider belongs to the edge the aside is docked against.
    { overlay: false, side: "start", class: "border-e border-border" },
    { overlay: false, side: "end", class: "border-s border-border" },
  ],
  defaultVariants: { side: "start", overlay: false },
});

export interface ShellAsideProps
  extends ComponentProps<typeof ark.aside>,
    VariantProps<typeof shellAsideVariants> {
  /** Docked width in px. Ignored when `overlay`, where the aside fills its container. */
  width?: number;
}

/**
 * A side region — navigation, a dock, an inspector. Renders `<aside>`, so it is a
 * complementary landmark: give it an `aria-label` when a page has more than one.
 *
 * Logical properties throughout (`border-e` / `border-s`, `side="start" | "end"`), not
 * physical left/right, so the whole shell mirrors under RTL without a second code path.
 *
 * For a RESIZABLE aside, compose Ark's Splitter around it rather than reaching for a prop —
 * the drag behaviour, keyboard resizing and ARIA come from the machine, and this component
 * stays presentational.
 */
export function ShellAside({
  className,
  side,
  overlay,
  width,
  style,
  slot,
  ...rest
}: ShellAsideProps) {
  return (
    <ark.aside
      className={cn(shellAsideVariants({ side, overlay }), className)}
      data-side={side ?? "start"}
      // `width` is a genuinely computed value the caller owns (and drives from drag state),
      // which is the sanctioned inline-style exception. An overlay fills its container, so
      // applying it there would fight the `inset-0`.
      style={overlay ? style : { width, ...style }}
      {...rest}
      data-slot={slot ?? "shell-aside"}
    />
  );
}
ShellAside.displayName = "ShellAside";
