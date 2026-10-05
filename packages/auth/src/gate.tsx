"use client";

import { useSession } from "./use-session";

/**
 * Show `children` to someone who holds `role`, and `fallback` to everyone else.
 *
 * **This hides UI and protects nothing**, for the reason `can` carries: a product gated only here is
 * ungated.
 *
 * The question is asked inside the current tenant, `session.organization`, unless `organization`
 * names another — the same default as `useSession().can`.
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
  const { can, status } = useSession();

  // While the session is still being read, or could not be, neither answer is known to be true, so
  // neither is drawn. Rendering the fallback here is the flicker worth avoiding — "you cannot do
  // this" shown to someone who can, for as long as the session endpoint takes — and rendering the
  // children is worse, because it flashes a control and then retracts it.
  if (status === "loading" || status === "failed") return null;

  return <>{can(role, organization) ? children : fallback}</>;
}
