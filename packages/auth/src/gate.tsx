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
  const { can } = useSession();
  return <>{can(role, organization) ? children : fallback}</>;
}
