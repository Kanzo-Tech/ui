"use client";

import { ark } from "@ark-ui/react/factory";
import { LockIcon } from "lucide-react";
import { createContext, useContext, useId, type ComponentProps } from "react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Float, type FloatProps } from "../simples/float.js";

// A region shown but not yet usable. Ark ships nothing for it, so the ARIA contract is ours:
//
// - `GatedContent` is `inert`. Per HTML, inert content is unfocusable, is hit-tested as if it had
//   `pointer-events: none`, and is withheld from the accessibility tree — it is NOT readable to a
//   screen reader, which is what `aria-hidden` would have done too.
// - So `GatedBadge` is the only readable part: plain text, outside the inert subtree, in reading
//   order after the content it replaces. Its lock is `aria-hidden`; the words are the reason.
// - `GatedRoot` is `role="group"`, described by the badge. Name it with `aria-label` after the
//   feature — the visible title is inside the inert subtree and cannot name anything — and a
//   screen reader announces "Scheduled runs, group, Coming soon" where the region was.

const GatedContext = createContext<string | undefined>(undefined);

export function GatedRoot({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  const id = useId();
  return (
    <GatedContext.Provider value={id}>
      <ark.div
        role="group"
        aria-describedby={id}
        className={cn("relative", className)}
        {...rest}
        data-slot={slot ?? "gated"}
      />
    </GatedContext.Provider>
  );
}
GatedRoot.displayName = "GatedRoot";

/** Takes what it holds out of focus, pointer and the accessibility tree. It is not dimmed: fading
 *  the text costs its contrast, so the gate is marked by the badge's lock and words instead. */
export function GatedContent({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={className}
      inert
      {...rest}
      data-slot={slot ?? "gated-content"}
    />
  );
}
GatedContent.displayName = "GatedContent";

// Straddles the edge it is pinned to by half an `sm` badge, read off `Float`'s own
// `data-placement`. It overhangs the root, so leave room with MARGIN on the root: padding would move
// the content and leave the badge where it was.
const straddle =
  "data-[placement^=top]:-top-2.5 data-[placement^=bottom]:-bottom-2.5 data-[placement$=start]:-start-2.5 data-[placement$=end]:-end-2.5";

export interface GatedBadgeProps extends ComponentProps<typeof Badge> {
  /** @default "top-end" */
  placement?: FloatProps["placement"];
}

/** The reason, as a lock and a label in a `Badge` pinned to a corner of the root. It is what
 *  describes the root. */
export function GatedBadge({ placement = "top-end", slot, children, ...rest }: GatedBadgeProps) {
  const id = useContext(GatedContext);
  return (
    <Float className={straddle} placement={placement}>
      <Badge id={id} size="sm" variant="secondary" {...rest} slot={slot ?? "gated-badge"}>
        <LockIcon aria-hidden />
        {children}
      </Badge>
    </Float>
  );
}
GatedBadge.displayName = "GatedBadge";
