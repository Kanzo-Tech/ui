import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";

/**
 * Skip navigation — the affordance four places in this library already cite as the reason for
 * `decisions/exactly-one-main.md`, and which nothing implemented until now.
 *
 * ## ARIA contract
 *
 * Ark ships no machine for this, and it is right not to: a skip link is markup plus a focus
 * target, with no state to keep. So the contract is written here, as a bespoke part owes.
 *
 * - **Roles.** `SkipNavLink` is a bare `<a href="#…">` — role `link`, no ARIA attribute of any
 *   kind. `SkipNavContent` declares no role either; when it is the shell's `<main>` (see below)
 *   the landmark is `ShellMain`'s.
 * - **Keyboard.** Tab reaches the link because it is the first focusable element in the document;
 *   Enter activates it. We handle no key: the browser's own fragment navigation does the work,
 *   which is why there is no machine to wrap.
 * - **Announced.** The link's text, and then whatever the target region announces on entry. The
 *   link carries `sr-only`, **not** `hidden` or `aria-hidden` — it is removed from the visual tree
 *   and kept in the accessibility one, which is what lets a sighted keyboard user and a screen
 *   reader user reach the same element. `display: none` would take it out of both and there would
 *   be nothing to tab to.
 * - **`tabIndex={-1}` on the target is the load-bearing half.** Without it a browser scrolls the
 *   id into view and leaves focus on the link, so the user's next Tab walks straight back into the
 *   navigation they just skipped — the exact defect the link exists to remove.
 *
 * ## What we changed from Shark UI, and why
 *
 * - **`data-slot` after `{...rest}`, plus a `slot` prop.** Shark writes the attribute before the
 *   spread, where a caller's own `data-slot` silently wins — `decisions/a-primitive-owns-its-slot.md`,
 *   held by `packages/ui/src/data-slot.test.tsx`.
 * - **The focus ring is the house spelling**, `ring-[3px]`, where Shark's file writes `ring-2`.
 *   Note what this is *not*: Shark's ring here is already solid, so the 1.29:1 measurement that
 *   bought `decisions/a-measurement-overrules-the-reference.md` its divergence does not apply to
 *   this file. What is left is one pixel of width, chosen so the ring matches every other focusable
 *   thing in the library. Appearance is explicitly outside `shark-parity.test.ts`'s claim.
 * - **No `"use client"`.** Shark ships the directive; this module calls no hook, registers no
 *   listener and writes no inline handler, so under the client-boundary rule it must not have one and
 *   `packages/ui/src/client-boundary.test.ts` enforces that in both directions.
 *
 * Kept verbatim, and deliberately: `focus:inset-s-4` is already logical (Tailwind v4 compiles it to
 * `inset-inline-start`, verified against 4.3.2 — it is not a dead class), and
 * `sr-only focus:not-sr-only` is the whole mechanism. Neither is ours to improve.
 */

/** The default id, so the link and the target agree without either call site writing a string. */
const SKIP_NAV_ID = "skip-nav-content";

export interface SkipNavLinkProps extends React.ComponentProps<typeof ark.a> {
  /**
   * The id of the element to skip to. This is the target's id, **not** this anchor's — it becomes
   * the `href` fragment. Shark's signature, kept.
   *
   * @default "skip-nav-content"
   */
  id?: string;
}

/**
 * The link itself. Render it as the **first** child of the page — inside `ShellRoot`, above
 * `ShellHeader` — because "first focusable element" is the entire specification.
 *
 * Every utility is behind `focus:`, the ring included, and that is the one place this component
 * departs from the library's `focus-visible:` spelling — so it is the one a reader will want to
 * "fix". Do not: `focus:not-sr-only` is what reveals the element, and the whole recipe describes
 * one appearance that exists under one condition. Keying the ring to a *different* condition means
 * that wherever the two disagree — a pointer or an assistive-technology activation matches `:focus`
 * and not `:focus-visible` — the element appears as a bare block of primary fill with no boundary
 * against the page behind it.
 */
export const SkipNavLink = (props: SkipNavLinkProps) => {
  const { id = SKIP_NAV_ID, className, children, slot, ...rest } = props;

  return (
    <ark.a
      className={cn(
        "focus:fixed focus:inset-s-4 focus:top-4 focus:z-9999",
        "focus:px-4 focus:py-2",
        "focus:bg-primary",
        "focus:text-primary-foreground focus:text-sm",
        "sr-only focus:not-sr-only",
        "focus:rounded-lg",
        "outline-none focus:ring-[3px] focus:ring-ring",
        className,
      )}
      href={`#${id}`}
      {...rest}
      data-slot={slot ?? "skip-nav-link"}
    >
      {children ?? "Skip to content"}
    </ark.a>
  );
};

export interface SkipNavContentProps extends React.ComponentProps<typeof ark.div> {
  /**
   * The id `SkipNavLink` targets.
   *
   * @default "skip-nav-content"
   */
  id?: string;
}

/**
 * The target the link lands on.
 *
 * **In a shell, hand it to `ShellMain` rather than nesting it inside one** —
 * `decisions/the-skip-target-is-the-main-landmark.md`:
 *
 * ```tsx
 * <SkipNavContent asChild>
 *   <ShellMain>…</ShellMain>
 * </SkipNavContent>
 * ```
 *
 * The `<main>` then *is* the focus target, one element instead of two, and the landmark a screen
 * reader enters is the one the user asked for. Rendered on its own it is a plain `<div>`, which is
 * what a consumer with no shell needs and all Shark can offer, having no layout layer.
 *
 * `outline-none` is not the focus-ring rule being broken. WCAG 2.4.7 asks for a visible indicator
 * on components in the *keyboard interface*, and a `tabIndex={-1}` region is reachable only by
 * script; drawing a ring around the whole page body on arrival would be noise, not an affordance.
 */
export const SkipNavContent = (props: SkipNavContentProps) => {
  const { id = SKIP_NAV_ID, className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("outline-none", className)}
      id={id}
      tabIndex={-1}
      {...rest}
      data-slot={slot ?? "skip-nav-content"}
    />
  );
};
