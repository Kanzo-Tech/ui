"use client";

import { can } from "./can";
import { useSession } from "./use-session";

/**
 * Show `children` to someone who holds `role`, and `fallback` to everyone else.
 *
 * **This hides UI and protects nothing**, for the reason {@link can} carries: a product gated only
 * here is ungated.
 *
 * `organization` asks the question inside that organization rather than against the realm roles,
 * and {@link can} does not merge the two.
 */
export function Gate({
  role,
  organization,
  fallback = null,
  children,
}: {
  readonly role: string;
  readonly organization?: string;
  readonly fallback?: React.ReactNode;
  readonly children?: React.ReactNode;
}) {
  const { session, status } = useSession();

  // While the session is still being read, neither answer is known to be true, so neither is
  // drawn. Rendering the fallback here is the flicker worth avoiding — "you cannot do this" shown
  // to someone who can, for as long as the session endpoint takes — and rendering the children is
  // worse, because it flashes a control and then retracts it.
  if (status === "loading") return null;

  return <>{can(session, role, organization) ? children : fallback}</>;
}
