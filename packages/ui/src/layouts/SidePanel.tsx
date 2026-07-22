import { ark } from "@ark-ui/react/factory";
import type { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import "./shell.css";

export const sidePanelVariants = tv({
  base: "flex flex-col bg-card",
  variants: {
    /** Docked (false) sits in the flow and carries the divider; narrow (true) floats over
     *  the content as a full-screen overlay, so it has no border. */
    narrow: {
      true: "absolute inset-0 z-5",
      false: "min-w-0 shrink-0",
    },
    side: { left: "", right: "" },
    /** Play the slide-out animation instead of slide-in. Only ever true in narrow mode. */
    closing: { true: "", false: "" },
  },
  compoundVariants: [
    // The divider belongs to the edge the panel is docked against.
    { narrow: false, side: "left", class: "border-r border-border" },
    { narrow: false, side: "right", class: "border-l border-border" },
    // Slide animations exist only for the narrow overlay.
    { narrow: true, side: "left", closing: false, class: "kz-aside-in-left" },
    { narrow: true, side: "right", closing: false, class: "kz-aside-in-right" },
    { narrow: true, side: "left", closing: true, class: "kz-aside-out-left" },
    { narrow: true, side: "right", closing: true, class: "kz-aside-out-right" },
  ],
  defaultVariants: { narrow: false, closing: false },
});

export interface SidePanelProps
  extends Omit<ComponentProps<typeof ark.aside>, "children">,
    VariantProps<typeof sidePanelVariants> {
  side: "left" | "right";
  /** Docked width in px. Ignored in narrow mode, where the panel fills its container. */
  width: number;
  children?: ComponentProps<typeof ark.aside>["children"];
}

/** A docked side panel — semantically an `<aside>` (the app's primary content is the
 *  `<main>`). One component for both layouts: docked with a fixed width on wide
 *  viewports, or a full-screen overlay sliding in from its own edge on narrow ones.
 *  Domain-free: the caller owns the width and the open/close (`closing`) state. For a
 *  resizable dock, use {@link WorkspaceLayout} (Ark Splitter) instead. */
export function SidePanel({
  side,
  width,
  narrow = false,
  closing = false,
  className,
  style,
  ...rest
}: SidePanelProps) {
  return (
    <ark.aside
      className={cn(sidePanelVariants({ narrow, side, closing }), className)}
      data-slot="side-panel"
      data-side={side}
      // `width` is a genuinely computed value (the caller owns it, and WorkspaceLayout
      // drives it from drag state), which is the sanctioned inline-style exception. In
      // narrow mode the overlay fills its container, so it must not be applied.
      style={narrow ? style : { width, ...style }}
      {...rest}
    />
  );
}
SidePanel.displayName = "SidePanel";
