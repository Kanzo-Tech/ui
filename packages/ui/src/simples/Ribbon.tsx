import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Badge, type BadgeVariant } from "./badge.js";

const ribbonVariants = tv({
  slots: {
    root: "relative",
    content: "",
    badge: "",
  },
  variants: {
    placement: {
      /**
       * Overlaid, straddling the corner so it reads as a tag pinned ON the thing rather
       * than a label sitting inside it. Note the overhang: an ancestor that scrolls or
       * hides overflow will clip it, so give the wrapper room.
       */
      corner: {
        badge: "absolute -end-2 -top-2",
      },
      /**
       * In the flow, not over it. The badge is a flex sibling of the content and takes
       * its own width, so it can never land on top of the text it annotates — which is
       * exactly what an absolutely-positioned "inline" badge used to do to any row whose
       * trailing edge was not, in fact, free.
       */
      inline: {
        root: "flex items-center gap-2",
        content: "min-w-0 flex-1",
        badge: "shrink-0",
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
   * Where the ribbon sits. Default "corner" — overlaid on the top-inline-end corner, which
   * reads as a label ON the thing. "inline" puts it in the flow at the trailing edge, so it
   * takes its own space instead of covering the content.
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
 * The label is whatever state you are flagging: Beta, New, Coming soon, Pro.
 *
 * By default it only annotates — the content stays live. Pass `disabled` to also gate it: the
 * region is dimmed and made `inert`, so an unavailable feature can stay visible without being
 * operable. `inert` rather than `aria-hidden` keeps the content readable, just unreachable.
 *
 * Reach for a plain `Badge` when you only need to tag something inline; reach for this when the
 * marker belongs to a region rather than a line of text.
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

      <Badge className={styles.badge()} size="xs" variant={variant}>
        {label}
      </Badge>
    </div>
  );
}
Ribbon.displayName = "Ribbon";
