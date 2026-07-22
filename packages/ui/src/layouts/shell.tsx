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
 * Parts are exported FLAT (`ShellBar`, not `Shell.Bar`). A namespace object built with
 * `Object.assign` does not survive the RSC client boundary — `Preferences` learned that the
 * hard way, and its compound statics had to be re-exported flat.
 */

export const shellBarVariants = tv({
  base: "flex shrink-0 select-none items-center gap-2 bg-card text-muted-foreground",
  variants: {
    /** Which edge the divider sits on. A bar is a boundary; the border says which side of it
     *  the content is. */
    position: {
      top: "border-b border-border",
      bottom: "border-t border-border",
    },
    size: {
      /** Status-bar scale — the thinnest strip that still fits a 16px icon. */
      sm: "h-[1.625rem] px-1.5 text-[length:var(--kanzo-font-size-small,11px)]",
      /** Toolbar scale. The default. */
      md: "h-8 px-2 text-[length:var(--kanzo-font-size-small,11px)]",
      /** Utility-strip scale — taller, for a bar carrying text rather than controls. */
      lg: "px-5 py-1 text-sm",
    },
  },
  defaultVariants: { position: "top", size: "md" },
});

export interface ShellBarProps
  extends ComponentProps<typeof ark.div>,
    VariantProps<typeof shellBarVariants> {}

/**
 * A thin horizontal strip with start / center / end clusters. This one component replaces
 * `Toolbar`, `StatusBar` and `TopBarUtility`, which were three implementations of the same
 * pattern — each specific shell had brought its own. `WorkspaceLayout` did not even use
 * `Toolbar`; it copied its recipe by hand into `PanelHeader`.
 *
 * ARIA: renders a plain `div` and declares NO role by default. Two deliberate omissions.
 *
 * It is not a `role="toolbar"`: that role promises a single tab stop navigated with arrow
 * keys, and a bar holding arbitrary children cannot provide roving focus. `Toolbar` and
 * `StatusBar` both used to claim it without implementing it. For a real toolbar of uniform
 * controls, compose a `ToggleGroup` inside — that is what gives you Ark's roving focus.
 *
 * It is not a landmark either. A bottom bar is often `role="contentinfo"` (`StatusBar` set
 * that), but a toolbar strip is not, and a shell may have several bars — declaring a landmark
 * here would mint duplicates. Pass `role` and `aria-label` at the call site when the bar is
 * genuinely a landmark.
 */
export function ShellBar({ className, position, size, ...rest }: ShellBarProps) {
  return (
    <ark.div
      className={cn(shellBarVariants({ position, size }), className)}
      data-slot="shell-bar"
      data-position={position ?? "top"}
      {...rest}
    />
  );
}
ShellBar.displayName = "ShellBar";

/** Takes the free space and truncates, so a long path ellipsises instead of pushing the end
 *  cluster off the bar. */
export function ShellBarStart({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap",
        className,
      )}
      data-slot="shell-bar-start"
      {...rest}
    />
  );
}
ShellBarStart.displayName = "ShellBarStart";

/** Centred cluster. Never shrinks. */
export function ShellBarCenter({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}
      data-slot="shell-bar-center"
      {...rest}
    />
  );
}
ShellBarCenter.displayName = "ShellBarCenter";

/** Trailing cluster: status text, then controls. Never shrinks. */
export function ShellBarEnd({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap", className)}
      data-slot="shell-bar-end"
      {...rest}
    />
  );
}
ShellBarEnd.displayName = "ShellBarEnd";

// ── Root ─────────────────────────────────────────────────────────────────────

/**
 * The outermost region: a full-height column that bars and the body stack inside.
 *
 * `h-dvh` rather than `h-screen`: on mobile browsers `100vh` includes the retracting URL bar,
 * so a shell sized with it is taller than the visible viewport and its bottom bar sits off
 * screen. `min-h-0` is what lets the body shrink and its own regions scroll instead of the
 * page growing.
 */
export function ShellRoot({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("flex h-dvh min-h-0 flex-col overflow-hidden", className)}
      data-slot="shell-root"
      {...rest}
    />
  );
}
ShellRoot.displayName = "ShellRoot";

/** The horizontal band between the bars: asides and main sit here as siblings, in the order
 *  the caller writes them — which is also what makes the layout mirror correctly in RTL. */
export function ShellBody({ className, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("relative flex min-h-0 flex-1", className)}
      data-slot="shell-body"
      {...rest}
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
export function ShellMain({ className, ...rest }: ComponentProps<typeof ark.main>) {
  return (
    <ark.main
      className={cn("flex min-w-0 flex-1 flex-col overflow-auto", className)}
      data-slot="shell-main"
      {...rest}
    />
  );
}
ShellMain.displayName = "ShellMain";

// ── Aside ────────────────────────────────────────────────────────────────────

export const shellAsideVariants = tv({
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
  ...rest
}: ShellAsideProps) {
  return (
    <ark.aside
      className={cn(shellAsideVariants({ side, overlay }), className)}
      data-slot="shell-aside"
      data-side={side ?? "start"}
      // `width` is a genuinely computed value the caller owns (and drives from drag state),
      // which is the sanctioned inline-style exception. An overlay fills its container, so
      // applying it there would fight the `inset-0`.
      style={overlay ? style : { width, ...style }}
      {...rest}
    />
  );
}
ShellAside.displayName = "ShellAside";
