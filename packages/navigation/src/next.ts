/**
 * `@kanzo-tech/navigation/next` — the two App Router navigations the root cannot see.
 *
 * Next writes the URL of a client navigation *after* the new route has rendered, so by the time the
 * browser reports it there is nothing left to cancel. What Next does offer is public and early:
 * `Link`'s `onNavigate`, and the router a component asks for. This door is those two, wired to the
 * same blockers `useBlocker` registers.
 *
 * ```ts
 * import { Link, useRouter } from "@kanzo-tech/navigation/next";
 * ```
 *
 * A raw `next/link` or `useRouter` from `next/navigation` walks past both, and nothing at runtime
 * can notice. The lint rule that closes that is on `/docs/navigation-guard/next`.
 */

export { Link } from "./next-link";
export { useRouter } from "./next-router";
