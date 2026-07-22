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
