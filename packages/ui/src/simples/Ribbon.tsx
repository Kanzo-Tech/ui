import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Badge, type BadgeVariant } from "./badge.js";
import { Float } from "./float.js";

const ribbonVariants = tv({
  slots: {
    root: "",
    content: "",
  },
  variants: {
    placement: {
      /**
       * Overlaid, straddling the corner so it reads as a tag pinned ON the thing. The overhang
       * comes from `Float` plus a negative offset — an ancestor that scrolls or hides overflow
       * will clip it, so give the wrapper room.
       *
       * The badge anchors to the ROOT, not to the content box, so it sits outside the root's
       * padding: `className="p-3"` moves the content and leaves the badge where it was, still
       * overlapping the row above. Space a corner ribbon with MARGIN (`mt-3`) — that moves the
       * root, and the badge goes with it.
       */
      corner: {
        root: "relative",
      },
      /**
       * In the flow, not over it. The badge is a flex sibling that takes its own width, so it
       * can never land on top of the content it annotates.
       */
      inline: {
        root: "flex items-center gap-2",
        content: "min-w-0 flex-1",
      },
    },
    /** Gating is opt-in: only a `disabled` ribbon dims and inert-locks its region. */
    disabled: {
      true: {
        content: "pointer-events-none opacity-50",
      },
    },
  },
  defaultVariants: {
    placement: "corner",
    disabled: false,
  },
});

export interface RibbonProps {
  children: ReactNode;
  /** The status you are marking on the region: "Beta", "New", "Coming soon", "Pro"… */
  label: ReactNode;
  /** Badge tone. Defaults to the neutral Badge variant. */
  variant?: BadgeVariant;
  /**
   * Where the ribbon sits. Default "corner" — overlaid on the top-inline-end corner via
   * `Float`, which reads as a label ON the thing. "inline" puts it in the flow at the trailing
   * edge, so it takes its own space instead of covering the content.
   */
  placement?: "corner" | "inline";
  /**
   * Gate the wrapped region: dim it AND make it `inert`, so it stays visible (still telling
   * the user it exists) but cannot be operated. Opt-in — a plain ribbon like "Beta" or "New"
   * leaves the content usable; turn this on for "Coming soon" or otherwise locked features.
   *
   * @default false
   */
  disabled?: boolean;
  className?: string;
}

/**
 * Ribbon — pins a status badge onto a whole region, the way Ant Design's `Badge.Ribbon` does.
 * A thin wrapper over `Float` (corner placement) + `Badge`. The label is whatever state you are
 * flagging: Beta, New, Coming soon, Pro.
 *
 * By default it only annotates — the content stays live. Pass `disabled` to also gate it: the
 * region is dimmed and made `inert`. `inert` rather than `aria-hidden` keeps it readable, just
 * unreachable. Reach for a plain `Badge` to tag something inline; reach for this when the marker
 * belongs to a region rather than a line of text.
 */
export function Ribbon({
  children,
  label,
  variant,
  placement = "corner",
  disabled = false,
  className,
}: RibbonProps) {
  const styles = ribbonVariants({ placement, disabled });

  const badge = (
    <Badge size="xs" variant={variant}>
      {label}
    </Badge>
  );

  return (
    <div
      className={cn(styles.root(), className)}
      data-disabled={disabled || undefined}
      data-placement={placement}
      data-slot="ribbon"
    >
      <div className={styles.content()} data-slot="ribbon-content" inert={disabled}>
        {children}
      </div>

      {placement === "corner" ? (
        <Float className="-end-2 -top-2" placement="top-end">
          {badge}
        </Float>
      ) : (
        <span className="shrink-0">{badge}</span>
      )}
    </div>
  );
}
Ribbon.displayName = "Ribbon";
