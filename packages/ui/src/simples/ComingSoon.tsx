import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Badge } from "./badge.js";

const comingSoonVariants = tv({
  slots: {
    root: "relative",
    content: "pointer-events-none opacity-50",
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
  },
  defaultVariants: {
    placement: "corner",
  },
});

export interface ComingSoonProps {
  children: ReactNode;
  /** Badge copy. Default "Coming soon". */
  label?: ReactNode;
  /**
   * Where the badge sits. Default "corner" — overlaid on the top-inline-end corner, which
   * reads as a label ON the thing. "inline" puts the badge in the flow at the trailing
   * edge, so it takes its own space instead of covering the content.
   */
  placement?: "corner" | "inline";
  className?: string;
}

/**
 * Marks a not-yet-available feature by wrapping it: the content is dimmed AND made
 * inert, with a badge over it.
 *
 * This is a decorator, not a label — it changes behaviour, so an unavailable control can
 * stay visible (and keep telling the user it exists) without being operable. Reach for a
 * plain `Badge` when you only need to annotate something that still works.
 */
export function ComingSoon({
  children,
  label = "Coming soon",
  placement = "corner",
  className,
}: ComingSoonProps) {
  const styles = comingSoonVariants({ placement });

  return (
    <div
      className={cn(styles.root(), className)}
      data-placement={placement}
      data-slot="coming-soon"
    >
      {/* aria-hidden would hide the content entirely; inert keeps it readable but
          unreachable, which is what "exists, not yet" should mean. */}
      <div className={styles.content()} data-slot="coming-soon-content" inert>
        {children}
      </div>

      <Badge className={styles.badge()} size="xs">
        {label}
      </Badge>
    </div>
  );
}
ComingSoon.displayName = "ComingSoon";
