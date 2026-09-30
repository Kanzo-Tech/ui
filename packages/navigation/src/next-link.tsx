"use client";

import NextLink from "next/link";
import { useRouter as useNextRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";
import { evaluate, locationOf } from "./registry";

type LinkProps = ComponentProps<typeof NextLink>;
type Href = LinkProps["href"];

/** The URL a `Link` goes to, spelled the way `router.push` takes it. */
function hrefOf(href: Href): string {
  if (typeof href === "string") return href;
  const { pathname, query, search, hash } = href;
  let tail = search ?? "";
  if (!tail && query) {
    const params = new URLSearchParams();
    if (typeof query === "string") tail = query;
    else {
      for (const [key, value] of Object.entries(query)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          if (item !== undefined && item !== null) params.append(key, String(item));
        }
      }
      tail = params.toString();
    }
  }
  if (tail && !tail.startsWith("?")) tail = `?${tail}`;
  const fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `${pathname ?? ""}${tail}${fragment}`;
}

/**
 * `next/link`, with `onNavigate` consulting the blockers.
 *
 * `onNavigate` is the only cancellable moment Next offers a link: it runs after `Link` has
 * prevented the click and before it dispatches. A blocker that answers `false` synchronously costs
 * nothing — the link navigates as it would have. Any other answer cancels now, and a `proceed`
 * re-issues the navigation through `router.push` or `router.replace` with the same `scroll`. The
 * re-issued one does not carry `useLinkStatus`'s pending state; that is the price of a decision
 * that could not be made synchronously.
 */
export function Link(props: LinkProps) {
  const { href, as, replace, scroll, onClick, onNavigate } = props;
  const router = useNextRouter();
  // The anchor's own `href` is the destination as the browser resolved it — base path, relative
  // segments and all — which is what `shouldBlockFn` is owed. `onClick` runs just before
  // `onNavigate`, on the same click.
  const clicked = useRef<string | undefined>(undefined);

  return (
    <NextLink
      {...props}
      onClick={(event) => {
        clicked.current = event.currentTarget.href;
        onClick?.(event);
      }}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented) return;

        const target = hrefOf(as ?? href);
        const verdict = evaluate({
          current: locationOf(location.href),
          next: locationOf(clicked.current ?? target, location.href),
          action: replace ? "REPLACE" : "PUSH",
        });
        if (verdict === false) return;
        event.preventDefault();
        if (verdict === true) return;
        void verdict.then((block) => {
          if (block) return;
          if (replace) router.replace(target, { scroll });
          else router.push(target, { scroll });
        });
      }}
    />
  );
}
