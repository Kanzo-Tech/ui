import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Badge } from "./badge.js";

export interface ComingSoonProps {
  children: ReactNode;
  /** Badge copy. Default "Coming soon". */
  label?: ReactNode;
  /**
   * Where the badge sits. Default "corner" — the top-inline-end corner, which reads as a
   * label ON the thing. "inline" centres it vertically at the trailing edge, for rows
   * whose right side is empty.
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
  return (
    <div
      className={cn("relative", className)}
      data-placement={placement}
      data-slot="coming-soon"
    >
      {/* aria-hidden would hide the content entirely; inert keeps it readable but
          unreachable, which is what "exists, not yet" should mean. */}
      <div className="pointer-events-none opacity-50" inert>
        {children}
      </div>
      <Badge
        className={cn(
          "absolute",
          // Straddles the corner so it reads as a tag pinned ON the thing rather than a
          // label sitting inside it. Note the overhang: an ancestor that scrolls or hides
          // overflow will clip it, so give the wrapper room.
          placement === "corner"
            ? "-end-2 -top-2"
            : "-translate-y-1/2 end-2 top-1/2"
        )}
        size="xs"
      >
        {label}
      </Badge>
    </div>
  );
}
ComingSoon.displayName = "ComingSoon";
